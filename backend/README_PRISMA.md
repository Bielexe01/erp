Prisma & Postgres setup

1) Instale dependências no backend:

   cd backend
   npm install

2) Configure seu `DATABASE_URL` (ex.: Postgres local) em `.env` ou variáveis de ambiente.
   Veja `.env.example`.

3) Gerar client e criar a migrations (ou push):

   npx prisma generate
   npx prisma migrate dev --name init --create-only
   npx prisma db push

4) Rodar o backend com Prisma:

   set DATABASE_URL="postgresql://user:pass@localhost:5432/pdv_db"
   npm run dev

Observações:
- O projeto usa Prisma quando `DATABASE_URL` estiver definido; caso contrário, continua usando `lowdb` para prototipagem rápida.
- Modelos principais: `Product` (com `quantity`), `Customer`, `Order` + `OrderItem`.
- Ao criar um pedido via API, o estoque do produto é decrementado automaticamente.
