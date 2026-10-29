// Identificação AUTOMÁTICA de tags a partir do conteúdo da receita.
// O usuário não preenche nada: o sistema analisa ingredientes, nome,
// tempo de preparo e o cálculo nutricional e define as tags sozinho.

import { calcularNutricao, interpretar } from './nutricao.js';

const GLUTEN = [
  'trigo', 'farinha de trigo', 'farinha integral', 'pao', 'pão', 'rap10', 'wrap',
  'tortilha', 'macarrao', 'macarrão', 'espaguete', 'nhoque', 'lasanha', 'cuscuz',
  'biscoito', 'cookie', 'granola', 'aveia', 'cevada', 'centeio', 'seitan',
  'shoyu', 'molho de soja', 'cervja', 'cerveja',
];
const LACTEOS = [
  'leite', 'queijo', 'iogurte', 'requeijao', 'requeijão', 'ricota', 'cottage',
  'cream cheese', 'creme de leite', 'manteiga', 'margarina', 'nata', 'chantilly',
  'whey',
];
const CARNES = [
  'frango', 'carne', 'boi', 'patinho', 'acem', 'alcatra', 'costela', 'bacon',
  'presunto', 'salsicha', 'linguica', 'linguiça', 'mortadela', 'salame', 'peru',
  'salmao', 'salmão', 'peixe', 'atum', 'sardinha', 'camarao', 'camarão',
  'bacalhau', 'merluza', 'truta', 'polvo', 'carne seca', 'charque', 'hamburguer',
];
const NAO_VEGANO = ['ovo', 'ovos', 'gema', 'clara', 'mel'];

const temAlgum = (texto, lista) => lista.some((p) => texto.includes(p));

export function detectarTags(receita = {}) {
  // texto normalizado de todos os ingredientes + nome
  const ingredientes = (receita.ingredientes || [])
    .map((i) => {
      const bruto = String(i?.item ?? i?.texto ?? i ?? '');
      return (interpretar(i, bruto).itemLimpo || bruto).toLowerCase();
    })
    .join(' | ');
  const texto = `${ingredientes} | ${String(receita.nome || '').toLowerCase()}`;

  const nut = calcularNutricao(receita.ingredientes || [], receita.porcoes || 1);
  const tags = [];

  if ((Number(receita.tempo_preparo_min) || 999) <= 15) tags.push('rapido');
  if (!temAlgum(texto, GLUTEN)) tags.push('sem-gluten');
  if (!temAlgum(texto, LACTEOS)) tags.push('sem-lactose');

  const semCarne = !temAlgum(texto, CARNES);
  if (semCarne) tags.push('vegetariano');
  if (semCarne && !temAlgum(texto, LACTEOS) && !temAlgum(texto, NAO_VEGANO)) tags.push('vegano');

  if ((nut.proteinas_g || 0) >= 18) tags.push('alto-proteico');
  if ((nut.carboidratos_g || 999) <= 15) tags.push('low-carb');

  return [...new Set(tags)];
}

// rótulos bonitos para exibição
export const ROTULO_TAG = {
  'rapido': 'até 15 min',
  'sem-gluten': 'sem glúten',
  'sem-lactose': 'sem lactose',
  'vegetariano': 'vegetariano',
  'vegano': 'vegano',
  'alto-proteico': 'alto proteico',
  'low-carb': 'low carb',
};
