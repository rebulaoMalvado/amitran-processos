// Parser de OFX (Open Financial Exchange) — funciona para OFX 1.x (SGML) e 2.x (XML).
// Extrai as transações (STMTTRN) do arquivo, no navegador (nada é enviado a servidor).

export interface OfxTransacao {
  fitid: string
  acctid: string
  bankid: string
  data: string // YYYY-MM-DD
  valor: number // assinado: negativo = saída, positivo = entrada
  tipo: string
  descricao: string
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp('<' + name + '>([^<\\r\\n]*)', 'i'))
  return m ? m[1].trim() : ''
}

// DTPOSTED: 'YYYYMMDD[HHMMSS][.XXX][TZ]' -> 'YYYY-MM-DD'
function parseData(dt: string): string {
  const d = dt.replace(/[^0-9]/g, '')
  if (d.length < 8) return ''
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function parseValor(v: string): number {
  // OFX usa ponto decimal; alguns bancos usam vírgula.
  const n = Number(v.replace(/\s/g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function parseOfx(text: string): OfxTransacao[] {
  const acctid = tag(text, 'ACCTID')
  const bankid = tag(text, 'BANKID')

  const blocks = text.split(/<STMTTRN>/i).slice(1)
  const out: OfxTransacao[] = []
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0]
    const fitid = tag(block, 'FITID')
    const data = parseData(tag(block, 'DTPOSTED'))
    if (!fitid || !data) continue
    const descricao = tag(block, 'MEMO') || tag(block, 'NAME') || ''
    out.push({
      fitid,
      acctid,
      bankid,
      data,
      valor: parseValor(tag(block, 'TRNAMT')),
      tipo: tag(block, 'TRNTYPE'),
      descricao,
    })
  }
  return out
}
