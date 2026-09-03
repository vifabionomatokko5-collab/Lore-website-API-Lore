async function carregarProdutos() {
    const container = document.getElementById("products");

    try {
        const response = await fetch("/api/store/products", {
            method: "GET",
            headers: {
                Accept: "application/json"
            },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Erro HTTP " + response.status);
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.products)) {
            throw new Error("Resposta inválida da API.");
        }

        if (data.products.length === 0) {
            container.innerHTML = `
                <div class="loading">
                    Nenhum produto disponível no momento.
                </div>
            `;

            return;
        }

        container.innerHTML = data.products.map(product => `
            <article class="product-card">

                <h3>${escapar(product.name)}</h3>

                <p>
                    ${escapar(product.description || "")}
                </p>

                <strong class="product-price">
                    R$ ${Number(product.price)
                        .toFixed(2)
                        .replace(".", ",")}
                </strong>

                <button
                    class="buy-button"
                    data-product-id="${escaparAtributo(product.id)}"
                >
                    Comprar
                </button>

            </article>
        `).join("");

        container
            .querySelectorAll(".buy-button")
            .forEach(button => {
                button.addEventListener("click", () => {
                    comprar(button.dataset.productId);
                });
            });

    } catch (error) {

        console.error(
            "Erro ao carregar loja:",
            error
        );

        container.innerHTML = `
            <div class="loading">
                Não foi possível carregar a loja.
            </div>
        `;
    }
}


async function comprar(productId) {
    if (!productId) {
        alert("Produto inválido.");
        return;
    }

    const buttons =
        document.querySelectorAll(".buy-button");

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const response = await fetch(
            "/api/store/checkout",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                body: JSON.stringify({
                    productId
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                "Não foi possível iniciar o pagamento."
            );
        }

        if (!data.checkout_url) {
            throw new Error(
                "URL de pagamento não recebida."
            );
        }

        window.location.href =
            data.checkout_url;

    } catch (error) {

        console.error(
            "Erro ao iniciar pagamento:",
            error
        );

        alert(
            "Não foi possível iniciar o pagamento.\n\n" +
            (error.message || "Tente novamente.")
        );

        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}


function escapar(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escaparAtributo(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("'", "&#039;");
}

carregarProdutos();
