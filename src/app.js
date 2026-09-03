require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const fs = require("fs");

const {
    MercadoPagoConfig,
    Preference,
    Payment,
    WebhookSignatureValidator,
    InvalidWebhookSignatureError
} = require("mercadopago");

const app = express();

app.set("trust proxy", 1);

const PORT = Number(process.env.PORT) || 3001;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

const LORE_API_URL =
    process.env.LORE_API_URL ||
    "https://api-lore-bot-website.onrender.com";

const API_TOKEN = process.env.API_TOKEN;

const MERCADOPAGO_ACCESS_TOKEN =
    process.env.MERCADOPAGO_ACCESS_TOKEN;

const mercadoPagoClient =
    MERCADOPAGO_ACCESS_TOKEN
        ? new MercadoPagoConfig({
            accessToken:
                MERCADOPAGO_ACCESS_TOKEN
        })
        : null;

app.disable("x-powered-by");

app.use(express.json());

/*
 * ========================================
 * SESSÃO
 * ========================================
 */

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "lore-development-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            secure:
                process.env.NODE_ENV === "production",

            sameSite: "lax",

            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

/*
 * ========================================
 * ARQUIVOS ESTÁTICOS
 * ========================================
 */

app.use(express.static(__dirname));
app.get("/servidor", (req, res) => {
    res.sendFile(path.join(__dirname, "pages", "servidor.html"));
});


/*
 * ========================================
 * DISCORD OAUTH2
 * ========================================
 */

app.get("/auth/discord", (req, res) => {
    if (!CLIENT_ID || !REDIRECT_URI) {
        return res
            .status(500)
            .send(
                "OAuth2 da Lore não está configurado."
            );
    }

    const params = new URLSearchParams({
        client_id: CLIENT_ID,

        redirect_uri: REDIRECT_URI,

        response_type: "code",

        scope: "identify"
    });

    res.redirect(
        `https://discord.com/oauth2/authorize?${params.toString()}`
    );
});

/*
 * ========================================
 * CALLBACK DO DISCORD
 * ========================================
 */

app.get(
    "/auth/discord/callback",
    async (req, res) => {
        const { code } = req.query;

        if (!code) {
            return res
                .status(400)
                .send(
                    "Código OAuth2 não recebido."
                );
        }

        if (
            !CLIENT_ID ||
            !CLIENT_SECRET ||
            !REDIRECT_URI
        ) {
            return res
                .status(500)
                .send(
                    "OAuth2 da Lore não está configurado corretamente."
                );
        }

        try {
            /*
             * Troca o código pelo access token
             */

            const tokenResponse =
                await fetch(
                    "https://discord.com/api/oauth2/token",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded"
                        },

                        body:
                            new URLSearchParams({
                                client_id:
                                    CLIENT_ID,

                                client_secret:
                                    CLIENT_SECRET,

                                grant_type:
                                    "authorization_code",

                                code,

                                redirect_uri:
                                    REDIRECT_URI
                            })
                    }
                );

            if (!tokenResponse.ok) {
                const error =
                    await tokenResponse.text();

                console.error(
                    "Erro ao obter token do Discord:",
                    error
                );

                return res
                    .status(401)
                    .send(
                        "Não foi possível autenticar com o Discord."
                    );
            }

            const tokenData =
                await tokenResponse.json();

            /*
             * Busca o usuário
             */

            const userResponse =
                await fetch(
                    "https://discord.com/api/users/@me",
                    {
                        headers: {
                            Authorization:
                                `${tokenData.token_type} ${tokenData.access_token}`
                        }
                    }
                );

            if (!userResponse.ok) {
                console.error(
                    "Erro ao obter usuário Discord."
                );

                return res
                    .status(401)
                    .send(
                        "Não foi possível obter seu usuário Discord."
                    );
            }

            const user =
                await userResponse.json();

            /*
             * Salva somente os dados
             * necessários na sessão.
             */

            req.session.user = {
                id: user.id,

                username:
                    user.username,

                globalName:
                    user.global_name ||
                    user.username,

                avatar:
                    user.avatar
            };

            /*
             * Salva a sessão antes
             * de redirecionar.
             */

            req.session.save(
                (error) => {
                    if (error) {
                        console.error(
                            "Erro ao salvar sessão:",
                            error
                        );

                        return res
                            .status(500)
                            .send(
                                "Erro ao salvar sua sessão."
                            );
                    }

                    res.redirect("/painel");
                }
            );
        } catch (error) {
            console.error(
                "Erro no OAuth2:",
                error
            );

            res
                .status(500)
                .send(
                    "Erro interno durante o login."
                );
        }
    }
);

/*
 * ========================================
 * LOGOUT
 * ========================================
 */

app.get(
    "/auth/logout",
    (req, res) => {
        req.session.destroy(
            (error) => {
                if (error) {
                    console.error(
                        "Erro ao destruir sessão:",
                        error
                    );

                    return res
                        .status(500)
                        .send(
                            "Não foi possível sair."
                        );
                }

                res.clearCookie(
                    "connect.sid"
                );

                res.redirect("/");
            }
        );
    }
);

/*
 * ========================================
 * API — USUÁRIO ATUAL
 * ========================================
 */

app.get(
    "/api/me",
    (req, res) => {
        if (!req.session.user) {
            return res.json({
                authenticated: false,

                user: null
            });
        }

        res.json({
            authenticated: true,

            user: req.session.user
        });
    }
);

/*
 * ========================================
 * API — STATUS DO WEBSITE
 * ========================================
 */

app.get(
    "/api/status",
    (req, res) => {
        res.json({
            success: true,

            service: "Lore Website",

            status: "online",

            version: "2.0.0",

            timestamp:
                new Date().toISOString()
        });
    }
);

/*
 * ========================================
 * API — CONEXÃO COM LORE API
 * ========================================
 */

async function loreRequest(
    endpoint,
    options = {}
) {
    const headers = {
        Accept:
            "application/json",

        ...(options.headers || {})
    };

    /*
     * O token fica somente no servidor.
     * Nunca enviamos isso para o navegador.
     */

    if (API_TOKEN) {
        headers.Authorization =
            `Bearer ${API_TOKEN}`;
    }

    const response =
        await fetch(
            `${LORE_API_URL}${endpoint}`,
            {
                ...options,

                headers
            }
        );

    const text =
        await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = {
            success: false,

            message:
                "A API retornou uma resposta inválida."
        };
    }

    if (!response.ok) {
        const error =
            new Error(
                data.message ||
                `API respondeu com HTTP ${response.status}`
            );

        error.status =
            response.status;

        error.data = data;

        throw error;
    }

    return data;
}

/*
 * ========================================
 * API — STATUS DA LORE
 * ========================================
 */

app.get(
    "/api/lore/health",
    async (req, res) => {
        try {
            const data =
                await loreRequest(
                    "/api/v1/health"
                );

            res.json(data);
        } catch (error) {
            console.error(
                "Erro ao consultar health da Lore API:",
                error.message
            );

            res.status(503).json({
                success: false,

                status: "offline",

                message:
                    "Não foi possível conectar à Lore API."
            });
        }
    }
);

/*
 * ========================================
 * API — BOT
 * ========================================
 */

app.get(
    "/api/lore/bot",
    async (req, res) => {
        try {
            const data =
                await loreRequest(
                    "/api/v1/bot"
                );

            res.json(data);
        } catch (error) {
            console.error(
                "Erro ao consultar bot:",
                error.message
            );

            res.status(503).json({
                success: false,

                message:
                    "Não foi possível obter o status da Lore."
            });
        }
    }
);

/*
 * ========================================
 * API — COMANDOS
 * ========================================
 */

app.get(
    "/api/lore/commands",
    async (req, res) => {
        try {
            const data =
                await loreRequest(
                    "/api/v1/commands"
                );

            res.json(data);
        } catch (error) {
            console.error(
                "Erro ao consultar comandos:",
                error.message
            );

            res.status(503).json({
                success: false,

                count: 0,

                commands: [],

                message:
                    "Não foi possível obter os comandos."
            });
        }
    }
);


/*
 * ========================================
 * API — SERVIDORES
 * ========================================
 */

app.get(
    "/api/lore/servers",
    async (req, res) => {
        try {
            const data = await loreRequest(
                "/api/v1/servers"
            );

            res.json(data);
        } catch (error) {
            console.error(
                "Erro ao consultar servidores:",
                error.message
            );

            res.status(error.status || 503).json(
                error.data || {
                    success: false,
                    count: 0,
                    servers: [],
                    message:
                        "Não foi possível obter os servidores."
                }
            );
        }
    }
);

/*
 * ========================================
 * API — SERVIDOR
 * ========================================
 */

app.get(
    "/api/lore/server",
    async (req, res) => {
        try {
            const data =
                await loreRequest(
                    "/api/v1/servers"
                );

            res.json(data);
        } catch (error) {
            console.error(
                "Erro ao consultar servidor:",
                error.message
            );

            res.status(
                error.status || 503
            ).json(
                error.data || {
                    success: false,

                    message:
                        "Não foi possível obter os servidores."
                }
            );
        }
    }
);

/*
 * ========================================
 * PÁGINA PRINCIPAL
 * ========================================
 */

app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );
    }
);

/*
 * ========================================
 * PÁGINA DE COMANDOS
 * ========================================
 */

app.get(
    "/comandos",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );
    }
);

/*
 * ========================================
 * PAINEL
 * ========================================
 */

app.get(
    "/painel",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "pages",
                "painel.html"
            )
        );
    }
);

/*
 * ========================================
 * PÁGINA DE SERVIDORES
 * ========================================
 */

app.get(
    "/servidores",
    (req, res) => {
        res.sendFile(
            path.join(__dirname, "pages", "servidores.html")
        );
    }
);

/*
 * ========================================
 * PÁGINA DE SERVIDOR
 * ========================================
 */

app.get(
    "/servidor",
    (req, res) => {
        res.sendFile(
            path.join(__dirname, "pages", "servidor.html")
        );
    }
);

app.get("/loja", (req, res) => {
    res.sendFile(
        path.join(__dirname, "pages", "loja.html")
    );
});

app.get("/api/store/products", (req, res) => {
    try {
        const file = path.join(
            __dirname,
            "data",
            "products.json"
        );

        if (!fs.existsSync(file)) {
            return res.status(404).json({
                success: false,
                message: "Arquivo de produtos não encontrado."
            });
        }

        const data = JSON.parse(
            fs.readFileSync(file, "utf8")
        );

        const products = Array.isArray(data.products)
            ? data.products.filter(product => product.active)
            : [];

        res.json({
            success: true,
            products
        });

    } catch (error) {
        console.error("Erro ao carregar produtos da loja:", error);

        res.status(500).json({
            success: false,
            message: "Erro interno ao carregar a loja."
        });
    }
});



/*
 * ========================================
 * LOJA LORE — CHECKOUT MERCADO PAGO
 * ========================================
 */


/*
 * ========================================
 * LOJA LORE — WEBHOOK MERCADO PAGO
 * ========================================
 */

app.post("/api/store/webhook", async (req, res) => {
    try {
        console.log(
            "Mercado Pago webhook recebido:",
            JSON.stringify(req.body)
        );

        /*
         * O Mercado Pago espera uma resposta rápida.
         * A validação/consulta do pagamento será feita
         * antes da entrega do produto.
         */

        return res.sendStatus(200);

    } catch (error) {
        console.error(
            "Erro no webhook Mercado Pago:",
            error
        );

        return res.sendStatus(500);
    }
});

app.post("/api/store/checkout", async (req, res) => {
    try {
        if (!mercadoPagoClient) {
            return res.status(503).json({
                success: false,
                message: "Mercado Pago não está configurado."
            });
        }

        const { productId } = req.body;

        if (!req.session.user || !req.session.user.id) {
            return res.status(401).json({
                success: false,
                message: "Você precisa entrar com o Discord para comprar."
            });
        }

        if (!productId || typeof productId !== "string") {
            return res.status(400).json({
                success: false,
                message: "Produto inválido."
            });
        }

        const file = path.join(
            __dirname,
            "data",
            "products.json"
        );

        if (!fs.existsSync(file)) {
            return res.status(500).json({
                success: false,
                message: "Arquivo de produtos não encontrado."
            });
        }

        const data = JSON.parse(
            fs.readFileSync(file, "utf8")
        );

        const product = Array.isArray(data.products)
            ? data.products.find(
                item =>
                    item.id === productId &&
                    item.active === true
            )
            : null;

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Produto não encontrado."
            });
        }

        const price = Number(product.price);

        if (!Number.isFinite(price) || price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Preço do produto inválido."
            });
        }

        const preference = new Preference(
            mercadoPagoClient
        );

        const result = await preference.create({
            body: {
                items: [
                    {
                        id: String(product.id),
                        title: String(product.name),
                        description: String(
                            product.description || ""
                        ),
                        quantity: 1,
                        currency_id:
                            product.currency || "BRL",
                        unit_price: price
                    }
                ],

                back_urls: {
                    success:
                        "https://lore-website-api-lore.onrender.com/loja?payment=success",
                    failure:
                        "https://lore-website-api-lore.onrender.com/loja?payment=failure",
                    pending:
                        "https://lore-website-api-lore.onrender.com/loja?payment=pending"
                },

                auto_return: "approved",

                external_reference:
                    `lore_${product.id}_${req.session.user.id}_${Date.now()}`
            }
        });

        if (!result || !result.init_point) {
            throw new Error(
                "Mercado Pago não retornou init_point."
            );
        }

        return res.json({
            success: true,
            checkout_url: result.init_point
        });

    } catch (error) {
        console.error(
            "Erro ao criar checkout Mercado Pago:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Não foi possível criar o pagamento."
        });
    }
});


/*
 * ========================================
 * ERRO 404
 * ========================================
 */

app.use(
    (req, res) => {
        res
            .status(404)
            .send(`
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>404 — Lore</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;

            min-height: 100vh;

            display: flex;

            align-items: center;

            justify-content: center;

            background: #08050d;

            color: white;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            text-align: center;
        }

        h1 {
            font-size: 90px;

            margin: 0;

            color: #c084fc;
        }

        p {
            color: #a99fb4;
        }

        a {
            display: inline-block;

            margin-top: 15px;

            padding: 12px 22px;

            border-radius: 12px;

            background: #9333ea;

            color: white;

            text-decoration: none;

            font-weight: bold;
        }
    </style>
</head>

<body>

    <div>

        <h1>404</h1>

        <p>
            Essa página não existe.
        </p>

        <a href="/">
            Voltar para a Lore
        </a>

    </div>

</body>

</html>
        `);
    }
);

/*
 * ========================================
 * ERROS
 * ========================================
 */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {
        console.error(
            "Erro interno:",
            error
        );

        if (res.headersSent) {
            return next(error);
        }

        res
            .status(500)
            .json({
                success: false,

                message:
                    "Erro interno do servidor."
            });
    }
);

/*
 * ========================================
 * INICIAR SERVIDOR
 * ========================================
 */


/*
 * ========================================
 * LOJA LORE
 * ========================================
 */

app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            "================================="
        );

        console.log(
            "        LORE WEBSITE"
        );

        console.log(
            "================================="
        );

        console.log(
            "Status: ONLINE"
        );

        console.log(
            `Porta: ${PORT}`
        );

        console.log(
            `API: ${LORE_API_URL}`
        );

        console.log(
            `OAuth2: ${
                CLIENT_ID
                    ? "CONFIGURADO"
                    : "NÃO CONFIGURADO"
            }`
        );

        console.log(
            "================================="
        );
    }
);

module.exports = app;
