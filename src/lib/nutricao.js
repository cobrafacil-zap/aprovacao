// Cálculo AUTOMÁTICO de calorias + macronutrientes a partir dos ingredientes.
// Tabela ampla (kcal, carboidratos, proteínas e gorduras por 100 g) com
// pesos por unidade/medida caseira e sinônimos.
// Tudo é SEMPRE exibido como APROXIMADO — medidas e marcas variam.

const semAcento = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Formato por linha: nome|kcal|carb|prot|gord por 100g|pesos e aliases
// pesos: un (g por unidade) | xc (g por xícara) | cs (g por colher de sopa) | cd (colher de chá)
const DADOS = `
ovo|143|1.1|12.6|9.5|un:50;aliase:ovos
clara de ovo|47|0.7|10.9|0|un:30;aliase:claras
gema|353|1.6|16.3|30.6|un:17
banana|89|22.8|1.1|0.3|un:90;aliase:banana madura,nanica,prata
maca|52|13.8|0.3|0.2|un:130;aliase:maçã,fuji,verde
laranja|37|8.4|0.9|0.1|un:130;aliase:laranja pera
tangerina|37|8.9|0.7|0.1|un:90;aliase:bergamota,lima
limao|22|7.1|0.8|0.1|un:50;aliase:limão,suco de limao,raspas de limao
mamao|45|11.1|0.5|0.1|un:200;aliase:mamão,papaia
abacaxi|48|12.3|0.4|0.1|un:800;aliase:abacaxi perola
manga|54|15|0.8|0.2|un:200;aliase:manga palmer
uva|53|14|0.6|0.2|un:5;aliase:uva passa,passas
morango|30|6.8|0.9|0.3|un:15;aliase:morangos
amora|43|9.6|1.4|0.5|xc:140;aliase:mirtelo,blueberry,mirtilo
figo|43|10.7|1.1|0.2|un:40;aliase:figos
pera|53|14|0.3|0.2|un:120
pessego|33|8.7|0.9|0.1|un:120;aliase:pêssego,nectarina
goiaba|41|10.5|0.9|0.5|un:100
caqui|71|18.6|0.4|0.1|un:100
melancia|30|7.6|0.5|0|un:200
melao|29|7.5|0.7|0|un:200;aliase:melão
kiwi|51|11|0.9|0.4|un:70
maracuja|68|12.3|2.2|1.5|un:25;aliase:maracujá,polpa
acai|58|6.2|0.8|3.9|xc:240;aliase:açaí,tigela
abacate|96|6|1.2|8.4|un:120
ameixa|44|10.8|0.7|0|un:30;aliase:ameixas
caju|43|10.3|0.9|0.2|un:60
jabuticaba|45|11.4|0.6|0.1|un:5
coco|354|6|3.3|33|un:100;aliase:coco fresco,coco ralado
leite de coco|230|5|2|24|xc:240;cs:15
graviola|52|13|0.8|0.2
acerola|32|7.7|0.9|0.2
pitanga|33|8|1.2|0.4
frutas vermelhas|45|10|0.8|0.3|xc:150;aliase:frutas,fruta

leite integral|61|4.7|3.2|3.3|xc:240;cs:15
leite desnatado|35|5|3.4|0.2|xc:240;aliase:leite sem lactose
leite condensado|313|57|7.4|6.7|xc:300;cs:19;lata:395
leite em po|475|38|25|27|cs:15;aliase:leite em pó,ninho
iogurte|51|4.7|4|1.5|xc:240;cs:15;aliase:iogurte natural,iogurte grego,iogurte desnatado,iogurte bebivel
requeijao|257|3.5|9.6|22.5|cs:15;aliase:requeijão
queijo minas frescal|264|3.2|17.4|20.6|xc:120;aliase:queijo branco,queijo frescal,queijo minas
queijo mussarela|330|3|25|25|un:30;xc:110;aliase:muçarela,mussarela,queijo fatia
queijo parmesao|392|1.7|35.6|25|cs:6;aliase:parmesão,queijo ralado
queijo prato|360|2|25|28|un:30
ricota|140|3.5|11|9.5|xc:120;cs:15;aliase:creme de ricota,cream cheese light
cottage|98|3.4|11|4.3|xc:120
queijo coalho|315|2.5|22|24|un:30
cream cheese|250|4|10|22|cs:15
manteiga|720|0.1|0.4|82|cs:14;cd:5
creme de leite|337|3|2|35|xc:240;cs:15;lata:200;aliase:caixa de creme de leite
margarina|720|0.2|0.3|82|cs:14
whey protein|400|8|80|6|cs:12;aliase:whey

peito de frango|159|0|32|2.5|un:150;aliase:frango,filé de frango,file de frango,frango desfiado,frango grelhado,peito de frango grelhado
coxa de frango|215|0|28|11|un:130;aliase:sobrecoxa,frango com pele
peru|135|0|29|1|un:150;aliase:peito de peru
carne moida|219|0|31|9|aliase:patinho,carne bovina,alcatra,acem,carne de panela,cubos de carne
costela|380|0|25|30
lombo suino|210|0|31|9|aliase:lombo,porco
pernil|250|0|25|15
presunto|145|1.5|18|8|un:20
bacon|541|0.6|37|42|un:15
salsicha|280|2|12|24|un:60
linguica|295|2|16|25|un:80;aliase:linguiça,linguiça calabresa
mortadela|269|3.5|14|22|un:30
salame|355|1|21|29|un:15
carne seca|270|0|32|15;aliase:carne de sol,charque
hamburguer|250|5|14|19|un:100;aliase:hambúrguer

salmao|208|0|20|13|un:150;aliase:salmão,salmao grelhado
tilapia|128|0|26|3|un:130;aliase:tilápia,peixe,peixe grelhado,filé de peixe
atum|116|0|25|1|lata:170;aliase:atum em lata,atum em oleo
sardinha|175|0|23|9|un:40;aliase:sardinha em lata
merluza|90|0|18|1|un:150
camarao|99|0.5|21|1|un:10;aliase:camarão,camarões
bacalhau|136|0|29|1
polvo|82|0|15|2
truta|150|0|20|7
ovo de codorna|158|0.4|13.1|11.1|un:12

feijao|76|13.6|4.8|0.5|xc:180;aliase:feijão,feijao cozido,feijao carioca,feijao preto
lentilha|93|16.3|6.3|0.5|xc:190;aliase:lentilha cozida
grao de bico|164|27.4|8.9|2.6|xc:160;aliase:grão-de-bico,grao-de-bico cozido
ervilha|62|11|4.3|0.4|xc:160;aliase:ervilha fresca
soja|330|30|36|20
tofu|76|1.9|8.1|4.8|un:100
amendoim|567|20|26|44|cs:12;aliase:pasta de amendoim
amendoa|579|20|21|50|cs:12;xc:140;aliase:amêndoas,amendoas
castanha de caju|553|30|18|44|cs:12;xc:140;aliase:castanha-de-caju,castanhas,mix de castanhas,castanhas
noz|654|14|15|65|cs:12;xc:140;aliase:nozes
castanha do para|656|12|16|66|un:5;aliase:castanha-do-pará,castanha do pará
pistache|560|28|20|45
chia|486|42|17|31|cs:12;aliase:sementes de chia
linhaca|534|29|18|42|cs:10;aliase:linhaça
gergelim|573|22|18|50|cs:9
tahine|595|21|17|54|cs:15;aliase:tahini
semente de girassol|570|20|21|51|cs:10
semente de abobora|540|54|20|25|cs:10;aliase:semente de abóbora,abóbora

arroz branco|128|28|2.5|0.2|xc:180;aliase:arroz,arroz cozido
arroz integral|124|25|2.6|1|xc:180;aliase:arroz integral cozido
macarrao|131|25|6|1|xc:140;aliase:macarrão,macarrao cozido,massa,espaguete,nhoque,lasanha
quinoa|120|21|4.4|1.9|xc:185;aliase:quinoa cozida
cuscuz|112|25|4|0.2|xc:150;aliase:cuscuz marroquino,pequeno milho
fubá|353|79|7|2|xc:120;cs:10;aliase:fuba,flocão,fubá mimoso,milho verde,milho
farinha de trigo|364|75|9.8|1.4|xc:120;cs:8;aliase:farinha,farinha de aveia,farinha integral
farinha de mandioca|330|78|1.5|0.3|xc:120;cs:8;aliase:flocao,farinha de mandioca,goma
goma de tapioca|358|88|0.2|0.1|xc:100;cs:10;aliase:tapioca,polvilho,polvilho azedo,polvilho doce,tapioca hidratada,tapioca pronta
aveia|389|66|14|7|xc:80;cs:20;aliase:aveia em flocos,flocos de aveia,farelo de aveia,granola
granola|471|65|12|20|xc:120;cs:15
barra de cereal|380|65|8|12|un:35;aliase:barra de cereal caseira,cereal bar
batata inglesa|52|12|1.2|0.1|un:130;xc:150;aliase:batata,batata cozida,purê de batata
batata doce|86|20|1.6|0.1|un:130;xc:150
mandioquinha|92|21|1.2|0.1|un:120;xc:150;aliase:batata baroa,purê de mandioquinha
inhame|97|23|1.5|0.1|un:120
mandioca|125|30|0.6|0.3|un:150;aliase:aipim,macaxeira
pao frances|300|58|8|7|un:50;aliase:pão,pão francês,pao de queijo,pão de queijo
pao integral|247|45|9|4|un:35;aliase:rap10,wrap,wrap integral,tortilha integral,pão integral
pao de forma|270|50|8|4|un:40
biscoito|450|75|6|15|un:12;aliase:biscoito integral,cookie,gotas de chocolate

acucar|387|99|0|0|cs:12;cd:4;aliase:açúcar,acucar refinado,acucar demerara,acucar mascavo,xarope de bordo
mel|304|82|0.4|0|cs:21
gelatina|335|84|8|0|cs:10;aliase:gelatina em po
chocolate|535|59|7|30|cs:15;aliase:chocolate ao leite,chocolate em gotas,calda de chocolate
chocolate meio amargo|546|61|5|31|cs:15;aliase:chocolate amargo,chocolate 70
cacau|228|58|20|14|cs:5;xc:80;aliase:cacau em po,cacau 100%
sorvete|207|23|3.5|11|xc:120;cs:15
doce de leite|315|57|7|7|cs:18
marmelada|250|65|0.4|0.1|cs:20;aliase:geleia,doce de abobora

azeite|884|0|0|100|cs:14;cd:5;aliase:azeite de oliva
oleo de soja|884|0|0|100|cs:14;aliase:óleo,oleo,oleo de girassol
oleo de coco|862|0|0|100|cs:14;aliase:óleo de coco
maionese|680|7|1|75|cs:15
ketchup|101|25|1|0.5|cs:15
mostarda|66|6|4|3|cs:15
shoyu|53|5|8|0|cs:15;aliase:shoyo,molho de soja
vinagre|18|3|0|0|cs:15
sal|0|0|0|0|cd:6;aliase:sal marinho,sal grosso
pimenta|255|64|10|12|cd:2;aliase:pimenta do reino,pimenta-do-reino,noz moscada,noz-moscada,paprica,páprica,cominho,curry,manjericao
oregano|265|69|9|4|cd:2;aliase:orégano,ervas,ervas finas,manjericao,manjericão,basilico
alho|149|33|6.4|0.5|un:5;aliase:dente de alho,alho amassado
cebola|40|9|1.1|0.1|un:80;aliase:cebola pequena,cebola roxa,cebola-roxa
salsinha|36|6|3|0.6|cs:4;aliase:salsa,salsinha picada,coentro,cebolinha
alho poro|31|7|2|0.2|un:80;aliase:alho-poró
fermento|53|27|13|0.3|cd:4;aliase:fermento em po,fermento biologico,bicarbonato
baunilha|288|12|0.1|0.1|cd:3;aliase:essencia de baunilha,essência de baunilha
canela|247|81|4|1.2|cd:3;cs:8;aliase:canela em po
agua|0|0|0|0|xc:240;aliase:água,agua quente,agua gelada,gelo
cafe|2|0|0.1|0|xc:240;aliase:café,cafe espresso
cha|1|0|0|0|xc:240;aliase:chá
suco natural|45|10|0.7|0.1|xc:240;aliase:suco,suco de laranja,suco de limonada
refrigerante|41|10|0|0|xc:240;aliase:coca,soda
cerveja|43|3|0.5|0|xc:240
vinho|75|2|0.1|0|xc:240

alface|15|2.8|1.3|0.2|xc:50;aliase:salada,folhas verdes,rucula,rúcula,escarola,salada verde,salada mista
couve|27|4.3|2.9|0.5|xc:30;aliase:couve manteiga
espinafre|23|3.8|2.9|0.4|xc:30;aliase:espinafre fresco
brocolis|34|7|2.8|0.4|xc:90;aliase:brócolis
couve flor|23|4.3|1.8|0.2|xc:90;aliase:couve-flor
abobrinha|17|4.3|1.1|0.1|un:200
cenoura|41|9.6|0.9|0.2|un:70
beterraba|43|9.6|1.6|0.1|un:100
tomate|18|3.9|1.1|0.2|un:100;aliase:tomate sem sementes,tomates,tomate cereja
pepino|12|2.2|0.7|0.1|un:150
pimentao|20|4.6|1|0.2|un:120;aliase:pimentão
chuchu|19|4.3|1.1|0.1|un:200
berinjela|20|4.6|1.1|0.1|un:200
abobora|26|6|1|0.1|xc:120;aliase:abóbora,abóbora cabotiá
repolho|25|5.4|1.3|0.1|xc:70
vagem|25|5|1.8|0.2|xc:80
cogumelo|22|3.3|3.1|0.3|xc:70;aliase:champignon,shimeji
milho verde|86|20|3.2|1.2|xc:160;lata:200
azeitona|115|5.2|1.1|10.9|cs:10;aliase:azeitonas,azeitona verde
palmito|28|4.6|2.5|0.3|xc:120;vidro:300
broto|23|3.5|3|0.2;aliase:broto de alfalfa,alfalfa
quiabo|30|6.2|1.9|0.1
nabo|22|4.5|1.1|0.1
aspargo|20|3.9|2.2|0.1
`;

// descritores que não mudam o alimento
const RUIDO = /\b(cozido|cozida|cozidos|fresco|fresca|frescos|picado|picada|picadas|ralado|ralada|ralados|em po|em pó|em fatias|em cubos|em pedacos|em pedaços|em rodela|em rodelas|em listras|desfiado|desfiada|sem sementes|meias-luas|pequeno|pequena|pequenos|grande|grandes|grelhado|grelhada|assado|assada|frito|frita|refogado|refogada|optional|opcional|para untar|a gosto|natural|caseiro|caseira|pronto|pronta)/g;

// tabela indexada
const TABELA = DADOS.trim().split('\n').map((linha) => {
  const [nome, kcal, carb, prot, gord, extra] = linha.split('|');
  const entrada = {
    nome: semAcento(nome),
    kcal100: Number(kcal), carb100: Number(carb), prot100: Number(prot), gord100: Number(gord),
    un: 100, xc: 240, cs: 15, cd: 5,
    aliase: [],
  };
  (extra || '').split(';').forEach((p) => {
    const [chave, valor] = p.split(':');
    if (chave === 'aliase') entrada.aliase = valor.split(',').map(semAcento);
    else if (['un', 'xc', 'cs', 'cd'].includes(chave)) entrada[chave] = Number(valor);
  });
  return entrada;
});

// Interpreta o ingrediente vindo como texto natural:
// "1 lata de atum" → qtd 1 | unidade lata | alimento "atum"
const RE_MEDIDA = /^(?:de\s+|das?\s+)?(?:xicaras?(?:\s+de\s+cha)?|colheres?(?:\s+de\s+(?:sopa|cha|cafe|sobremesa))?|gramas?|quilogramas?|quilos?|kg|ml|mililitros?|litros?|lats?|latas?|caixas?|caixinhas?|pacotes?|sacos?|vidros?|potes?|fatias?|dentes?|folhas?|pitadas?|punhados?|unidades?|und|un|fardos?|duzias?)\b\s*(?:de\s+|da\s+|do\s+)?/i;

export function interpretar(ing, bruto) {
  let texto = String(bruto || '').trim();
  let qtd = parseFloat(String(ing?.qtd ?? '').replace(',', '.'));
  if (Number.isNaN(qtd)) {
    const m = texto.match(/^\s*(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (m) {
      const [num, den] = m[1].split('/').map((x) => Number(x.trim()));
      qtd = den ? num / den : Number(String(m[1]).replace(',', '.'));
      texto = m[2];
    } else if (detectarUnidade(texto)) {
      qtd = 1; // "Colher de sopa de X" sem número = 1 medida
    }
  }
  let unidade = String(ing?.unidade || '').trim();
  if (!unidade) unidade = detectarUnidade(texto);
  const itemLimpo = texto.replace(RE_MEDIDA, '').trim();
  return { qtd: Number.isNaN(qtd) ? null : qtd, unidade, itemLimpo };
}

function acharAlimento(item) {
  // textos entre parênteses são descrições/alternativas — atrapalham o match
  const semParenteses = String(item || '').replace(/\([^)]*\)/g, ' ');
  const original = semAcento(semParenteses).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const limpo = original.replace(RUIDO, ' ').replace(/\s+/g, ' ').trim();
  // variações: sem hífens e sem plurais
  const singular = limpo.replace(/-/g, ' ').replace(/\b([a-z]+)s\b/g, '$1').replace(/\s+/g, ' ').trim();
  const candidatos = [original, limpo, singular];
  for (const e of TABELA) {
    const nomes = [e.nome, ...e.aliase];
    if (candidatos.some((c) => c && nomes.includes(c))) return e;
  }
  for (const e of TABELA) {
    const nomes = [e.nome, ...e.aliase];
    if (nomes.some((n) => n.length > 3 && (limpo.includes(n) || n.includes(limpo)))) return e;
  }
  return null;
}

// detecta a unidade quando ela vem no texto (ex.: "3 colheres de...", "500 g de...")
function detectarUnidade(texto) {
  const t = semAcento(texto);
  if (t.includes('grama') || /\d\s*g\b/.test(t)) return 'g';
  if (t.includes('quilo') || /\d\s*kg\b/.test(t)) return 'kg';
  if (t.includes('xicara') || t.includes('xic')) return 'xíc';
  if (t.includes('sopa')) return 'cs';
  if (t.includes('cafe')) return 'cd';
  if (t.includes('cha') || t.includes('sobremesa')) return 'cd';
  if (t.includes('colher')) return 'cs';
  if (t.includes('pitada')) return 'pn';
  if (t.includes('lata')) return 'lata';
  if (t.includes('caixa') || t.includes('caixinha')) return 'caixa';
  if (t.includes('pacote') || t.includes('saco')) return 'pacote';
  if (t.includes('vidro')) return 'vidro';
  if (t.includes('pote')) return 'pote';
  if (t.includes('fatia')) return 'fatia';
  if (t.includes('dente')) return 'dente';
  if (t.includes('folha')) return 'folha';
  if (t.includes('punhado') || t.includes('maço') || t.includes('maco')) return 'punhado';
  if (t.includes('duzia') || t.includes('dúzia')) return 'duzia';
  if (t.includes('mililitro') || /\d\s*ml\b/.test(t)) return 'ml';
  return '';
}

function paraGramas(qtd, unidade, entrada) {
  const n = parseFloat(String(qtd ?? '').replace(',', '.'));
  if (Number.isNaN(n)) return null;
  const un = semAcento(unidade).trim();
  if (un === 'g' || un === 'gr' || un === 'grama' || un === 'gramas') return n;
  if (un === 'kg') return n * 1000;
  if (un === 'ml') return n;
  if (un === 'l' || un === 'litro') return n * 1000;
  if (un.startsWith('xic') || un.startsWith('xíc')) return n * entrada.xc;
  if (un === 'cs' || un.includes('sopa')) return n * entrada.cs;
  if (un === 'cd' || un === 'cp' || un.includes('cha') || un.includes('sobremesa')) return n * entrada.cd;
  if (un === 'pn' || un === 'pitada' || un === 'ponta' || un === 'ramo' || un === 'unidade a gosto') return n;
  if (un === 'lata') return n * (entrada.lata || 200);
  if (un === 'caixa' || un === 'caixinha') return n * 200;
  if (un === 'pacote' || un === 'saco') return n * 250;
  if (un === 'vidro') return n * (entrada.vidro || 300);
  if (un === 'pote') return n * 200;
  if (un === 'punhado' || un === 'maço') return n * 30;
  if (un === 'duzia') return n * 12 * entrada.un;
  if (un === 'folha') {
    const wrap = entrada.nome.includes('pao') || (entrada.aliase || []).some((a) => /rap10|wrap|tortilha/.test(a));
    return n * (wrap ? 35 : 2);
  }
  if (un === 'fatia' || un === 'fatias' || un === 'pedaco' || un === 'pedaço') return n * 30;
  if (un === 'dente' || un === 'dentes') return n * 5;
  if (un === 'un' || un === 'unidade' || un === 'unidades' || un === '') return n * entrada.un;
  return n * 10; // medida desconhecida: estimativa conservadora
}

// Calcula calorias + macros por porção (sempre como estimativa aproximada).
export function calcularNutricao(ingredientes = [], porcoes = 1) {
  let kcal = 0, carb = 0, prot = 0, gord = 0, encontrados = 0;
  for (const ing of ingredientes) {
    const item = String(ing?.item ?? ing ?? '');
    const { qtd, unidade, itemLimpo } = interpretar(ing, item);
    const entrada = acharAlimento(itemLimpo || item);
    if (!entrada || qtd == null) continue;
    let gramas = paraGramas(qtd, unidade, entrada);
    if (gramas == null || gramas <= 0) continue;
    // "a gosto"/pitadas/untar: temperos contam pouco (máx. 5 g)
    if (/a gosto|pitada|se quiser|opcional|para untar/i.test(item)) gramas = Math.min(gramas, 5);
    const f = gramas / 100;
    encontrados++;
    kcal += f * entrada.kcal100;
    carb += f * entrada.carb100;
    prot += f * entrada.prot100;
    gord += f * entrada.gord100;
  }
  const p = Math.max(1, Number(porcoes) || 1);
  return {
    kcal_por_porcao: Math.round(kcal / p),
    carboidratos_g: Math.round((carb / p) * 10) / 10,
    proteinas_g: Math.round((prot / p) * 10) / 10,
    gorduras_g: Math.round((gord / p) * 10) / 10,
    ingredientes_calculados: encontrados,
    total_ingredientes: ingredientes.length,
    aproximado: true,
  };
}
