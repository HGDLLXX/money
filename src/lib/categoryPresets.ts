const CATEGORY_PRESETS = [
  { name: 'Alimentação', color: '#f97316', icon: 'utensils', type: 'expense' as const },
  { name: 'Mercado', color: '#84cc16', icon: 'shopping-cart', type: 'expense' as const },
  { name: 'Passeios e lazer', color: '#a855f7', icon: 'ticket', type: 'expense' as const },
  { name: 'Compras', color: '#ec4899', icon: 'shopping-bag', type: 'expense' as const },
  { name: 'Transporte', color: '#3b82f6', icon: 'car', type: 'expense' as const },
  { name: 'Saúde', color: '#ef4444', icon: 'heart-pulse', type: 'expense' as const },
  { name: 'Moradia', color: '#0891b2', icon: 'home', type: 'expense' as const },
  { name: 'Educação', color: '#6366f1', icon: 'graduation-cap', type: 'expense' as const },
  { name: 'Assinaturas', color: '#14b8a6', icon: 'repeat', type: 'expense' as const },
  { name: 'Contas', color: '#f59e0b', icon: 'receipt', type: 'expense' as const },
  { name: 'Outros', color: '#64748b', icon: 'more-horizontal', type: 'both' as const },
  { name: 'Salário', color: '#10b981', icon: 'briefcase', type: 'income' as const },
  { name: 'Trabalho extra', color: '#22c55e', icon: 'zap', type: 'income' as const },
  { name: 'Freelance', color: '#059669', icon: 'laptop', type: 'income' as const },
  { name: 'Vendas', color: '#0d9488', icon: 'tag', type: 'income' as const },
  { name: 'Presentes', color: '#d946ef', icon: 'gift', type: 'income' as const },
  { name: 'Outros recebimentos', color: '#64748b', icon: 'plus-circle', type: 'income' as const },
];

export default CATEGORY_PRESETS;
