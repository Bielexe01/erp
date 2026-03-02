PDV Backend

Instruções rápidas:

1) Instalar dependências:

   npm install

2) Rodar em dev:

   npm run dev

API endpoints básicos:

- POST /api/auth/register {username,password}
- POST /api/auth/login {username,password}
- GET/POST/PUT/DELETE /api/products
- GET/POST/PUT/DELETE /api/customers
- GET/POST/PUT/DELETE /api/orders

Observações:
- O backend usa lowdb (arquivo JSON em `src/db.json`) para persistência simples.
- Para produção, substitua por PostgreSQL/MySQL e adicione validação/autorização.
