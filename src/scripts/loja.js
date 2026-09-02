async function carregarProdutos() {
    const container = document.getElementById("products");

    try {
        const response = await fetch("/api/store/products");

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
                    ${escapar(product.description)}
                </p>

                <strong class="product-price">
                    R$ ${Number(product.price)
                        .toFixed(2)
                        .replace(".", ",")}
                </strong>

                <button
                    class="buy-button"
                    onclick="comprar('${escaparAtributo(product.id)}')"
                >
                    Comprar
                </button>

            </article>
        `).join("");

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

function comprar(productId) {
    alert(
        "Pagamento da LORE ainda está sendo configurado.\\n\\n" +
        "Produto: " + productId
    );
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
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'");
}

carregarProdutos();
