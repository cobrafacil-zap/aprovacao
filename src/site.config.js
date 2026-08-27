/**
 * Dados de configuração da campanha
 * Centraliza informações usadas em várias páginas
 *
 * Copy reescrita em primeira pessoa (voz da Elisângela) — sem slogans genéricos,
 * sem policy brief. Frases curtas, com causos, lugares e nomes concretos.
 *
 * ⚠️ ATENÇÃO LGPD/TSE: o CNPJ e o número de urna são públicos por exigência
 * da Justiça Eleitoral (Res. TSE 23.732/2024). Devem aparecer no rodapé.
 */

export const SITE = {
  // Identificação
  name: 'Elisângela Tomba',
  shortName: 'Elisângela',
  role: 'Candidata a Deputada Estadual',
  state: 'Paraná',
  party: 'PT',
  partyFull: 'Partido dos Trabalhadores',
  number: null, // ⚠️ Preencher com número de urna quando tiver
  coalition: null,

  // Slogan — frase de campanha, primeira pessoa
  slogan: 'Eu sou a neta da Francisca. Agora é a vez das nossas comunidades na Assembleia.',
  subtitle: 'Assistente social. Neta da vó Francisca. Fundadora da APAE de Jundiaí do Sul.',

  // Biografia curta — primeira pessoa, sem repetição "neta da"
  shortBio:
    'Nasci na roça colhendo café e algodão com a vó Francisca. ' +
    'Virei assistente social e fundei a APAE de Jundiaí do Sul. ' +
    'Vou levar a força das mulheres do Paraná pra Assembleia Legislativa.',

  // Contatos
  contacts: {
    whatsapp: '5546999999999',
    whatsappDisplay: '(46) 99999-9999',
    email: 'contato@elisangelatomba.com.br',
    press: 'imprensa@elisangelatomba.com.br',
    instagram: 'https://www.instagram.com/elisangelatomba',
    facebook: 'https://www.facebook.com/elisangelatomba',
    tiktok: null,
    youtube: null,
  },

  // Endereço do comitê (preencher quando tiver)
  address: {
    street: null,
    city: null,
    state: 'PR',
    zip: null,
  },

  // Identificação legal obrigatória (Res. TSE 23.732/2024)
  legal: {
    cnpjCampanha: '00.000.000/0001-00',
    cnpjPartido: '00.000.000/0001-00',
    partidoUf: 'PT - Paraná',
    autorizadoPor: 'PT - Diretório Estadual do Paraná',
    enderecoSiteComunicado: true,
  },

  // Configuração da Home — chamada curta com cara de campanha popular
  home: {
    heroTagline: 'Do Paraná que trabalha, com a força das mulheres, para quem mais precisa.',
    ctaPrimary: 'Leia minhas 7 propostas',
    ctaSecondary: 'Fala comigo no WhatsApp',
    quemEU: [
      'Neta da vó Francisca. Assentei no banco da escola pública do interior.',
      'Virei assistente social pra defender quem não tinha voz.',
      'Fundei a APAE de Jundiaí do Sul batendo de porta em porta.',
      'Levo essa história pra Assembleia Legislativa do Paraná.'
    ].join(' ')
  },

  // Meta/SEO
  seo: {
    title: 'Elisângela Tomba — Candidata a Deputada Estadual pelo Paraná',
    description:
      'Assistente social, neta da vó Francisca e fundadora da APAE de Jundiaí do Sul. ' +
      'Elisângela Tomba (PT) quer levar a força das mulheres do Paraná pra Assembleia Legislativa.',
    ogImage: '/og-image.jpg',
    twitterCard: 'summary_large_image',
  },

  // Integrações
  integrations: {
    donationPlatform: null,
    donationUrl: '#',
    whatsappGroup: null,
  },
};

export const NAV = [
  { href: '/', label: 'Início' },
  { href: '/sobre/', label: 'Sobre' },
  { href: '/propostas/', label: 'Propostas' },
  { href: '/apoie/', label: 'Apoie' },
  { href: '/contato/', label: 'Contato' },
];

// Pillars — 3 coisas que movem a Elisângela (não cards de palavras abstratas).
// Cada item já traz copy em primeira pessoa que pode ser usada na home.
export const PILLARS = [
  {
    id: 'mulheres',
    titulo: 'Mulheres na política',
    resumo: 'Mulher do interior sabe o que é decidir sozinha. Tô acostumada.',
    historia:
      'Minha avó criou 8 filhos sozinha na roça. Minha mãe criou a gente na cidade. ' +
      'Eu sei o que é mulher segurando tudo. Quero mais mulheres na Assembleia ' +
      'pra lei que decide seja feita por gente que vive o problema.',
    acoes: [
      'Lutar pela equiparação de salários entre homens e mulheres no funcionalismo público do PR',
      'Criar frentes de combate à violência obstétrica e ao assédio em ambientes de trabalho',
      'Defender creches e licença-maternidade como política de Estado, não favor',
    ],
  },
  {
    id: 'raizes',
    titulo: 'Direito de aprender, trabalhar e envelhecer',
    resumo: 'O interior do Paraná tem gente. Só falta política pública que chegue lá.',
    historia:
      'Eu cresci em cidade pequena de café e algodão. Sei como é não ter hospital, ' +
      'não ter transporte, não ter escola em tempo integral. Quero que o interior ' +
      'do Paraná tenha o mesmo que a capital tem — mas com a cara do interior.',
    acoes: [
      'Defender educação em tempo integral pras crianças das cidades pequenas',
      'Ampliar hospitais regionais e atendimento do interior em saúde mental',
      'Combater a violência contra a pessoa idosa e o etarismo no funcionalismo público',
    ],
  },
  {
    id: 'comunidade',
    titulo: 'Comunidade que decide junto',
    resumo: 'Nada se faz sozinho. Nem campanha, nem lei.',
    historia:
      'A APAE de Jundiaí do Sul nasceu assim: juntando famílias, voluntários, ' +
      'padaria do bairro, comércio, prefeitura. Aprendi que participação não é ' +
      'votar de 4 em 4 anos — é estar todo dia. Vou levar isso pra Assembleia.',
    acoes: [
      'Defender orçamento participativo regionalizado no Paraná',
      'Fortalecer APAEs e o terceiro setor com financiamento estável e plurianual',
      'Criar canais permanentes de consulta às comunidades rurais, quilombolas e periféricas',
    ],
  },
];

// Proposals — 7 eixos de luta em primeira pessoa, com verbos de ação.
export const PROPOSALS = [
  {
    id: 'crianca-juventude',
    numero: '01',
    titulo: 'Educação em tempo integral pras crianças do interior',
    intro:
      'Hoje a maioria das crianças pequenas de cidade pequena só tem aula até o 5º ano. ' +
      'Isso é escolha da Assembleia Legislativa, não da geografia.',
    corpo: [
      'Defender educação em tempo integral desde a educação infantil, começando pelas cidades pequenas do interior',
      'Programa estadual de transporte escolar gratuito entre distritos e sedes municipais',
      'Combate ativo ao trabalho infantil e à evasão escolar — criança na escola, não no campo',
      'Fortalecimento do ECA como política de Estado, não de governo de turno',
    ],
  },
  {
    id: 'mulheres',
    numero: '02',
    titulo: 'Mulheres no centro das decisões',
    intro:
      'Não basta abrir vaga pra mulher: precisa garantir que a mulher chegue, fique ' +
      'e decida. Sem violência, sem assédio, sem salário menor.',
    corpo: [
      'Equiparação salarial entre servidores homens e mulheres do estado do Paraná',
      'Programa estadual de creches públicas com financiamento plurianual',
      'Rede de proteção à mulher em situação de violência — presente em cada município',
      'Licença-maternidade de 6 meses no serviço público estadual como piso',
    ],
  },
  {
    id: 'pessoas-idosas',
    numero: '03',
    titulo: 'Envelhecer com dignidade é direito',
    intro:
      'O Paraná tem quase 2 milhões de pessoas idosas. A maioria quer viver bem, ' +
      'perto da família, sem medo. Hoje nem isso a gente garante.',
    corpo: [
      'Defesa ativa do Estatuto do Idoso com orçamento estadual próprio',
      'Combate ao etarismo no funcionalismo e nas instituições de saúde',
      'Programas de convivência e saúde mental nos municípios menores',
      'Acessibilidade universal em transporte, prédios públicos e calçadas',
    ],
  },
  {
    id: 'pcd',
    numero: '04',
    titulo: 'Inclusão real começa na infância',
    intro:
      'Eu fundei a APAE de Jundiaí do Sul batendo de porta em porta. Sei como é ' +
      'família esperando atendimento. Sei como é criança sem diagnóstico. ' +
      'Isso não pode esperar.',
    corpo: [
      'Fortalecimento da rede de APAEs e centros de atendimento no Paraná com repasse plurianual',
      'Acessibilidade universal em escolas, hospitais e órgãos públicos do estado',
      'Inclusão educacional e no mercado de trabalho — inclusive para famílias cuidadoras',
      'Diagnóstico precoce de deficiência como política permanente de saúde',
    ],
  },
  {
    id: 'saude',
    numero: '05',
    titulo: 'SUS de verdade, mesmo no interior',
    intro:
      'O SUS é nosso maior projeto de igualdade. Mas no interior tá tudo concentrado ' +
      'em Curitiba, Cascavel, Londrina. O resto espera na fila.',
    corpo: [
      'Fortalecimento da atenção básica e da Estratégia Saúde da Família em cada município',
      'Hospitais regionais estruturados — diagnóstico, internação e cirurgia não pode demorar 6 meses',
      'Saúde mental como prioridade de Estado: CAPS em todo município de médio porte',
      'Combate às filas com mutirões e regulação única em parceria com municípios',
    ],
  },
  {
    id: 'trabalho-renda',
    numero: '06',
    titulo: 'Trabalho decente pra quem produz comida',
    intro:
      'O Paraná alimenta o Brasil. Mas o agricultor familiar é o que menos ganha ' +
      'na mesa. Isso é injusto. E tem solução.',
    corpo: [
      'Apoio à agricultura familiar com política de compra pública do estado',
      'Fomento à economia solidária, cooperativas e agroecologia',
      'Programa de qualificação profissional para jovens do campo e da cidade',
      'Combate à informalidade com fiscalização que protege, não que pune',
    ],
  },
  {
    id: 'cultura-esporte',
    numero: '07',
    titulo: 'Cultura e esporte não são luxo',
    intro:
      'Quem é do interior sabe: cultura é festa da comunidade, futebol no campo, ' +
      'a banda municipal. Sem isso, cidade pequena morre.',
    corpo: [
      'Fomento à cultura popular e tradicional paranaense com edital permanente',
      'Programa de esporte comunitário nos bairros e municípios do interior',
      'Equipamentos culturais e esportivos nos municípios menores — com manutenção',
      'Apoio a pontos de cultura, coletivos e festas regionais',
    ],
  },
];

// Timeline — texto corrido da história da Elisângela, primeira pessoa.
export const TIMELINE = [
  {
    ano: '1976',
    titulo: 'Sou neta da Francisca',
    corpo:
      'Nasci em Jundiaí do Sul, norte pioneiro do Paraná. Minha avó criou 8 filhos ' +
      'sozinha na roça. Eu cresci colhendo café e algodão do lado dela. ' +
      'Aprendi cedo que trabalho e dignidade andam juntos.',
  },
  {
    ano: 'Juventude',
    titulo: 'O dia que entendi que era política',
    corpo:
      'Ainda muito jovem vi uma família do bairro perder atendimento que ' +
      'tinha direito porque ninguém tinha ido brigar pelo papel. ' +
      'Naquela noite decidi: ia trabalhar pra isso.',
  },
  {
    ano: '1996',
    titulo: 'Nasce a APAE de Jundiaí do Sul',
    corpo:
      'Reuni famílias, voluntários, padaria do bairro, comércio, prefeitura. ' +
      'Bati em porta até abrir a primeira sala com fono, fisio e psicopedagoga. ' +
      'Foi a primeira vez que vi o que política popular fazia de verdade.',
  },
  {
    ano: '2003',
    titulo: 'Virei assistente social',
    corpo:
      'Formei na Unespar e fui trabalhar com criança, adolescente, mulher, ' +
      'pessoa idosa, deficiência. A profissão me deu método pra defender o que eu já sentia: ' +
      'que ninguém deveria ser invisível pra um Estado.',
  },
  {
    ano: '2026',
    titulo: 'A hora de levar pra Assembleia',
    corpo:
      'Hoje o Paraná precisa de quem viveu o problema pra escrever a lei. ' +
      'Larguei o confortável e fui. Levo comigo a vó Francisca, a APAE, ' +
      'as mulheres do interior e a certeza de que o próximo deputado estadual ' +
      'vai ter nome e endereço do Paraná que trabalha.',
  },
];
