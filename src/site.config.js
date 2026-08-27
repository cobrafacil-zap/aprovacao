/**
 * Dados de configuração da campanha
 * Centraliza informações usadas em várias páginas
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
  coalition: null, // Federação/coligação se houver

  // Slogan
  slogan: 'Agora é oficial!',
  subtitle: 'Representatividade. Oportunidade. Comunidade.',

  // Biografia curta
  shortBio: 'Assistente social, liderança popular e neta da dona Francisca. Neta da avó Francisca, cresceu na área rural do Paraná colhendo café e algodão. Fundou a APAE de Jundiaí do Sul. Quer ser a voz de quem nunca teve voz na Assembleia Legislativa do Paraná.',

  // Contatos
  contacts: {
    whatsapp: '5546999999999', // ⚠️ Preencher com DDI+DDD+número
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
    cnpjCampanha: '00.000.000/0001-00', // ⚠️ Preencher com CNPJ real
    cnpjPartido: '00.000.000/0001-00',
    partidoUf: 'PT - Paraná',
    autorizadoPor: 'PT - Diretório Estadual do Paraná',
    enderecoSiteComunicado: true, // site hospedado no Brasil e comunicado à JE
  },

  // Configuração da Home
  home: {
    heroTagline: 'Do Paraná que trabalha, com a força das mulheres, para quem mais precisa.',
    ctaPrimary: 'Conheça minhas propostas',
    ctaSecondary: 'Fale comigo no WhatsApp',
  },

  // Meta/SEO
  seo: {
    title: 'Elisângela Tomba — Candidata a Deputada Estadual pelo Paraná',
    description: 'Assistente social, liderança popular e fundadora da APAE de Jundiaí do Sul. Conheça as propostas de Elisângela Tomba para um Paraná com mais representatividade, oportunidade e comunidade.',
    keywords: 'Elisângela Tomba, Deputada Estadual, Paraná, PT, APAE Jundiaí do Sul, eleições 2026',
    ogImage: '/og-image.jpg',
    twitterCard: 'summary_large_image',
  },

  // Integrações
  integrations: {
    donationPlatform: null, // Ex: 'appcivico', 'queroapoiar', 'gmt' (apenas as 4 do TSE)
    donationUrl: '#', // ⚠️ Preencher com URL da plataforma escolhida
    whatsappGroup: null, // Link de grupo de WhatsApp se houver
  },
};

export const NAV = [
  { href: '/', label: 'Início' },
  { href: '/sobre/', label: 'Sobre' },
  { href: '/propostas/', label: 'Propostas' },
  { href: '/agenda/', label: 'Agenda' },
  { href: '/noticias/', label: 'Notícias' },
  { href: '/imprensa/', label: 'Imprensa' },
  { href: /apoie/, label: 'Apoie' },
  { href: '/contato/', label: 'Contato' },
];

export const PILLARS = [
  {
    id: 'representatividade',
    title: 'Representatividade',
    icon: 'people',
    summary: 'Porque ninguém deve ser invisível.',
    body: 'Mulheres, juventude, pessoas com deficiência, pessoas idosas e comunidades rurais precisam ocupar os espaços de decisão. A política do Paraná não pode continuar decidindo sem quem mais precisa.',
    actions: [
      'Defender a ampliação da participação feminina na política paranaense',
      'Garantir voz ativa de pessoas com deficiência na construção de políticas públicas',
      'Lutar pela representação da agricultura familiar e do interior',
    ],
  },
  {
    id: 'oportunidade',
    title: 'Oportunidade',
    icon: 'star',
    summary: 'Porque ninguém deve ficar para trás.',
    body: 'Oportunidade não é favor — é direito. Educação, profissionalização, esporte, cultura e saúde que cheguem a todas as gerações, do campo à cidade.',
    actions: [
      'Ampliar investimento em educação integral e profissionalização de jovens',
      'Defender políticas públicas de proteção à pessoa idosa e combate ao etarismo',
      'Criar programas de geração de renda para mulheres chefes de família',
    ],
  },
  {
    id: 'comunidade',
    title: 'Comunidade',
    icon: 'home',
    summary: 'Porque nenhuma transformação acontece sozinha.',
    body: 'Comunidade é o que a Elisângela conhece desde criança: a roça, a colheita, a vizinhança, a associação de bairro, a APAE. Transformar começa por aí — e a Assembleia precisa estar aberta pra isso.',
    actions: [
      'Fortalecer conselhos locais e orçamentos participativos no Paraná',
      'Apoiar o terceiro setor e as APAEs do interior do estado',
      'Construir políticas públicas com — e não para — as comunidades',
    ],
  },
];

export const PROPOSALS = [
  {
    id: 'crianca-juvenato',
    title: 'Infância, Juventude e Educação',
    summary: 'Educação integral, profissionalização e proteção integral da criança e do adolescente.',
    bullets: [
      'Ampliar programas de educação integral em parceria com municípios',
      'Fortalecer o combate ao trabalho infantil e à evasão escolar',
      'Programas de profissionalização para jovens do interior',
      'Defesa ativa do Estatuto da Criança e do Adolescente (ECA)',
    ],
  },
  {
    id: 'mulheres',
    title: 'Mulheres e Proteção Social',
    summary: 'Igualdade de oportunidades, autonomia econômica e combate à violência.',
    bullets: [
      'Programas de geração de renda para mulheres chefes de família',
      'Fortalecimento da rede de proteção à mulher em situação de violência',
      'Apoio à saúde mental e integral da mulher',
      'Licença-maternidade e políticas de cuidado como política de Estado',
    ],
  },
  {
    id: 'pessoas-idosas',
    title: 'Pessoas Idosas',
    summary: 'Envelhecimento com dignidade, autonomia e proteção.',
    bullets: [
      'Defesa ativa do Estatuto do Idoso',
      'Combate ao etarismo e à violência contra a pessoa idosa',
      'Programas de saúde, lazer e convivência no interior',
      'Acessibilidade e mobilidade como prioridade',
    ],
  },
  {
    id: 'pessoas-deficiencia',
    title: 'Pessoas com Deficiência',
    summary: 'Inclusão real, direitos garantidos e continuidade do trabalho com APAEs.',
    bullets: [
      'Fortalecimento da rede de APAEs e centros de atendimento no Paraná',
      'Acessibilidade universal em serviços públicos',
      'Inclusão educacional e no mercado de trabalho',
      'Apoio às famílias cuidadoras',
    ],
  },
  {
    id: 'saude',
    title: 'Saúde Pública',
    summary: 'SUS forte, atenção básica e interior atendido.',
    bullets: [
      'Fortalecimento da atenção básica e da Estratégia Saúde da Família',
      'Interior do Paraná com hospitais regionais estruturados',
      'Saúde mental como prioridade de Estado',
      'Combate às filas e ampliação de exames e consultas especializadas',
    ],
  },
  {
    id: 'trabalho-renda',
    title: 'Trabalho e Geração de Renda',
    summary: 'Economia solidária, agricultura familiar e trabalho decente.',
    bullets: [
      'Apoio à agricultura familiar e à agroecologia',
      'Fomento à economia solidária e ao cooperativismo',
      'Programas de qualificação profissional',
      'Combate à informalidade e defesa do trabalho decente',
    ],
  },
  {
    id: 'cultura-esporte',
    title: 'Cultura, Esporte e Lazer',
    summary: 'Acesso a direitos culturais, esportivos e de lazer para todas as gerações.',
    bullets: [
      'Fomento à cultura popular e tradicional do Paraná',
      'Programas de esporte educacional e comunitário',
      'Equipamentos culturais e esportivos nos municípios menores',
      'Apoio a coletivos, pontos de cultura e festivais regionais',
    ],
  },
];

export const TIMELINE = [
  {
    year: 'Infância',
    title: 'Neta da Francisca, filha da roça',
    body: 'Cresceu na área rural do Paraná colhendo café e algodão com a avó. Aprendeu cedo que trabalho e dignidade andam juntos.',
  },
  {
    year: 'Jovem',
    title: 'Primeira mobilização',
    body: 'Ainda muito jovem, compreendeu que problemas coletivos exigem soluções coletivas. Começou a organizar comunidades.',
  },
  {
    year: 'Comunidade',
    title: 'Fundação da APAE de Jundiaí do Sul',
    body: 'Protagonista da fundação da APAE de Jundiaí do Sul — mobilizando famílias, voluntários e poder público para garantir atendimento às pessoas com deficiência do município.',
  },
  {
    year: 'Profissional',
    title: 'Serviço Social como vocação',
    body: 'Formou-se assistente social e dedicou a vida à defesa de direitos: criança e adolescente, juventude, mulheres, famílias e pessoas idosas.',
  },
  {
    year: '2026',
    title: 'Agora é oficial',
    body: 'Decidiu levar a sua história e a força das comunidades para a Assembleia Legislativa do Paraná. Candidata a Deputada Estadual pelo PT.',
  },
];
