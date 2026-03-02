const express = require('express')
const router = express.Router()
const prisma = require('../prismaClient')

router.get('/', async (req, res) => {
  const products = await prisma.product.findMany()
  res.json(products)
})

router.post('/', async (req, res) => {
  const { sku, name, embalagem, qtdEmbalagem, custoBruto, percentMarkup, precoVenda, estoque, estoqueMinimo, validade, categoria, fornecedor, marca, gtin, comissao, observacao, foto } = req.body
  const p = await prisma.product.create({ 
    data: { 
      sku,
      name, 
      embalagem: embalagem || 'UN',
      qtdEmbalagem: Number(qtdEmbalagem) || 1,
      custoBruto: Number(custoBruto) || 0,
      percentMarkup: Number(percentMarkup) || 0,
      precoVenda: Number(precoVenda) || 0,
      estoque: Number(estoque) || 0,
      estoqueMinimo: Number(estoqueMinimo) || 0,
      validade: validade ? new Date(validade) : null,
      categoria,
      fornecedor,
      marca,
      gtin,
      comissao: Number(comissao) || 0,
      observacao,
      foto
    } 
  })
  res.json(p)
})

router.put('/:id', async (req, res) => {
  const id = req.params.id
  const data = req.body
  const updated = await prisma.product.update({ where: { id }, data })
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const id = req.params.id
  await prisma.product.delete({ where: { id } })
  res.json({ ok: true })
})

module.exports = router
