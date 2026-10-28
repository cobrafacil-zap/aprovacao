// Cálculo AUTOMÁTICO de calorias a partir dos ingredientes.
// Tabela interna: kcal por 100 g + pesos por unidade/medida caseira.
// Tudo é ESTIMATIVA (pesos de medidas variam) — por isso sempre exibido
// com o aviso de aproximação e nunca como argumento de venda.

const semAcento = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// kcal100 = kcal por 100 g | un = g por unidade | xc = g por xícara | cs = g por colher de sopa
const TABELA = [
  { nome: 'ovo', kcal100: 143, un: 50, aliase: ['ovos', 'ovo de codorna'] },
  { nome: 'banana', kcal100: 89, un: 90 },
  { nome: 'aveia', kcal100: 389, xc: 80, cs: 20, aliase: ['aveia em flocos', 'flocos de aveia', 'farelo de aveia'] },
  { nome: 'canela', kcal100: 247, cs: 8, aliase: ['canela em po'] },
  { nome: 'oleo de coco', kcal100: 862, cs: 14, aliase: ['oleo'] },
  { nome: 'azeite', kcal100: 884, cs: 14, aliase: ['azeite de oliva'] },
  { nome: 'manteiga', kcal100: 717, cs: 14 },
  { nome: 'peito de frango', kcal100: 165, un: 150, aliase: ['frango', 'filé de frango', 'file de frango', 'frango desfiado'] },
  { nome: 'quinoa', kcal100: 120, xc: 185, aliase: ['quinoa cozida'] },
  { nome: 'abobrinha', kcal100: 17, un: 200 },
  { nome: 'cenoura', kcal100: 41, un: 70 },
  { nome: 'limao', kcal100: 29, un: 50, aliase: ['suco de limao', 'raspas de limao'] },
  { nome: 'tomate', kcal100: 18, un: 100, aliase: ['tomate sem sementes', 'tomates'] },
  { nome: 'cebola', kcal100: 40, un: 80, aliase: ['cebola pequena', 'cebola roxa', 'cebola-roxa'] },
  { nome: 'espinafre', kcal100: 23, xc: 30, aliase: ['espinafre fresco'] },
  { nome: 'queijo branco', kcal100: 264, aliase: ['queijo minas', 'queijo frescal'] },
  { nome: 'queijo', kcal100: 300, un: 30, aliase: ['mussarela', 'muçarela', 'queijo coalho', 'queijo ralado', 'requeijao', 'ricota'] },
  { nome: 'castanha de caju', kcal100: 553, cs: 12, aliase: ['castanha-de-caju', 'castanhas', 'mix de castanhas'] },
  { nome: 'amendoa', kcal100: 579, cs: 12, aliase: ['amendoas', 'amêndoas'] },
  { nome: 'noz', kcal100: 654, cs: 12, aliase: ['nozes'] },
  { nome: 'castanha do para', kcal100: 656, aliase: ['castanha-do-para', 'castanha do pará'] },
  { nome: 'amendoim', kcal100: 567, cs: 12, aliase: ['pasta de amendoim'] },
  { nome: 'mel', kcal100: 304, cs: 21 },
  { nome: 'abacate', kcal100: 160, un: 120 },
  { nome: 'cacau', kcal100: 228, cs: 5, aliase: ['cacau em po', 'cacau 100%', 'chocolate'] },
  { nome: 'goma de tapioca', kcal100: 358, cs: 10, aliase: ['tapioca', 'polvilho azedo', 'polvilho'] },
  { nome: 'salmao', kcal100: 208, un: 150, aliase: ['salmao fresco'] },
  { nome: 'mandioquinha', kcal100: 95, un: 120, aliase: ['batata baroa'] },
  { nome: 'batata doce', kcal100: 86, un: 130 },
  { nome: 'alho', kcal100: 149, un: 5 },
  { nome: 'salsinha', kcal100: 36, cs: 4, aliase: ['salsa', 'salsinha picada'] },
  { nome: 'grao de bico', kcal100: 164, xc: 160, aliase: ['grao-de-bico'] },
  { nome: 'lentilha', kcal100: 116, xc: 190, aliase: ['lentilha cozida'] },
  { nome: 'feijao', kcal100: 76, xc: 180, aliase: ['feijao cozido'] },
  { nome: 'pepino', kcal100: 15, un: 150 },
  { nome: 'tahine', kcal100: 595, cs: 15, aliase: ['tahini', 'gergelim'] },
  { nome: 'bebida vegetal', kcal100: 30, xc: 240, aliase: ['leite de coco', 'leite de amendoas', 'bebida de coco', 'leite'] },
  { nome: 'iogurte', kcal100: 60, xc: 240, cs: 15, aliase: ['iogurte natural', 'iogurte grego', 'iogurte desnatado'] },
  { nome: 'baunilha', kcal100: 288, cd: 3, aliase: ['essencia de baunilha'] },
  { nome: 'frutas vermelhas', kcal100: 45, xc: 150, aliase: ['morango', 'frutas', 'amora', 'mirtilo', 'figo', 'manga', 'maca', 'pera', 'uva', 'pessego', 'abacaxi', 'mamao', 'laranja', 'maracuja'] },
  { nome: 'chia', kcal100: 486, cs: 12, aliase: ['sementes de chia'] },
  { nome: 'linhaça', kcal100: 534, cs: 10 },
  { nome: 'arroz integral', kcal100: 123, xc: 180, aliase: ['arroz'] },
  { nome: 'macarrao integral', kcal100: 124, xc: 140, aliase: ['macarrao', 'massa'] },
  { nome: 'pao integral', kcal100: 247, un: 50, aliase: ['pao', 'tapioca pronta', 'tortilha'] },
  { nome: 'farinha de trigo', kcal100: 364, xc: 120, cs: 8, aliase: ['farinha', 'farinha de aveia'] },
  { nome: 'acucar', kcal100: 387, cs: 12, cd: 4, aliase: ['acucar demerara', 'acucar mascavo', 'xarope'] },
  { nome: 'leite condensado', kcal100: 321, xc: 300, cs: 19 },
  { nome: 'creme de leite', kcal100: 337, xc: 240, cs: 15 },
  { nome: 'granola', kcal100: 471, xc: 120, cs: 15 },
  { nome: 'tofu', kcal100: 76 },
  { nome: 'carne moida', kcal100: 172, aliase: ['patinho', 'acem', 'carne'] },
  { nome: 'tilapia', kcal100: 96, un: 130, aliase: ['peixe', 'file de peixe'] },
  { nome: 'atum', kcal100: 116, aliase: ['atum em lata'] },
  { nome: 'sardinha', kcal100: 208, aliase: ['sardinha em lata'] },
  { nome: 'presunto', kcal100: 145, un: 20 },
  { nome: 'bacon', kcal100: 541, un: 15 },
  { nome: 'alface', kcal100: 15, xc: 50, aliase: ['salada', 'folhas verdes', 'couve', 'rucula'] },
  { nome: 'brocolis', kcal100: 34, xc: 90, aliase: ['couve-flor'] },
  { nome: 'azeitona', kcal100: 115, cs: 10, aliase: ['azeitonas'] },
  { nome: 'milho', kcal100: 86, xc: 160, aliase: ['ervilha'] },
  { nome: 'coco ralado', kcal100: 660, cs: 10 },
  { nome: 'agua', kcal100: 0, aliase: ['agua quente', 'gelo'] },
  { nome: 'sal', kcal100: 0, aliase: ['pimenta', 'orégano', 'oregano', 'ervas', 'fermento', 'sal marinho', 'sal e', 'a gosto', 'pitada'] },
];

// descritores que não mudam o alimento
const RUIDO = /\b(cozido|cozida|fresco|fresca|picado|picada|ralado|ralada|em po|em pó|em fatias|em cubos|em rodela|em pedacos|desfiado|desfiada|sem sementes|meias-luas|pequeno|pequena|grande|fresco|gelada|quente|optional|opcional|para untar|a gosto)\b/g;

function acharAlimento(item) {
  let nome = semAcento(item).replace(/[()]/g, ' ').replace(RUIDO, ' ').replace(/\s+/g, ' ').trim();
  // 1) nome completo  2) sem ruido  3) conter/ser contido  4) aliases
  const candidatos = [semAcento(item).trim(), nome];
  for (const entrada of TABELA) {
    const nomes = [entrada.nome, ...(entrada.aliase || [])].map(semAcento);
    if (candidatos.some((c) => c && nomes.includes(c))) return entrada;
  }
  for (const entrada of TABELA) {
    const nomes = [entrada.nome, ...(entrada.aliase || [])].map(semAcento);
    if (nomes.some((n) => n.length > 3 && (nome.includes(n) || n.includes(nome)))) return entrada;
  }
  return null;
}

// converte a quantidade para gramas usando unidade + peso da medida
function paraGramas(qtd, unidade, entrada) {
  const n = parseFloat(String(qtd ?? '').replace(',', '.'));
  if (Number.isNaN(n)) return null;
  const un = semAcento(unidade);
  if (un === 'g' || un === 'gr' || un === 'grama' || un === 'gramas') return n;
  if (un === 'kg' || un === 'quilograma') return n * 1000;
  if (un === 'ml') return n;
  if (un === 'l' || un === 'litro') return n * 1000;
  if (un.startsWith('xíc') || un.startsWith('xic') || un === 'xíc' || un === 'xic') return n * (entrada.xc || 240);
  if (un === 'cs' || un.includes('sopa')) return n * (entrada.cs || 15);
  if (un === 'cd' || un.includes('cha') || un.includes('sobremesa')) return n * (entrada.cd || 5);
  if (un === 'un' || un === 'unidade' || un === 'unidades' || un === '') return n * (entrada.un || 100);
  return n * (entrada.un || 100);
}

// Calcula as calorias totais e por porção de uma receita.
export function calcularNutricao(ingredientes = [], porcoes = 1) {
  let total = 0;
  let encontrados = 0;
  for (const ing of ingredientes) {
    const item = ing?.item || String(ing);
    const entrada = acharAlimento(item);
    if (!entrada) continue;
    const gramas = paraGramas(ing.qtd, ing.unidade, entrada);
    if (gramas == null) continue;
    encontrados++;
    total += (gramas / 100) * entrada.kcal100;
  }
  const p = Math.max(1, Number(porcoes) || 1);
  return {
    kcal_total: Math.round(total),
    kcal_por_porcao: Math.round(total / p),
    ingredientes_calculados: encontrados,
    total_ingredientes: ingredientes.length,
    estimativa: true,
  };
}
