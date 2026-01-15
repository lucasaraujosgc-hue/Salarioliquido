import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Calculator, 
  Info, 
  Briefcase, 
  User, 
  TrendingDown, 
  DollarSign,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';

// --- Constants & Rules ---
const IR_TABLE = [
  { limit: 2428.80, rate: 0, deduction: 0 },
  { limit: 2826.65, rate: 0.075, deduction: 182.16 },
  { limit: 3751.05, rate: 0.15, deduction: 394.16 },
  { limit: 4664.68, rate: 0.225, deduction: 675.49 },
  { limit: Infinity, rate: 0.275, deduction: 908.73 }
];

// INSS Table 2025 (Old reference)
const INSS_TABLE_2025 = [
  { limit: 1518.00, rate: 0.075 },
  { limit: 2793.88, rate: 0.09 },
  { limit: 4190.83, rate: 0.12 },
  { limit: 8157.41, rate: 0.14 }
];

// INSS Table 2026 (New reference provided in image)
const INSS_TABLE_2026 = [
  { limit: 1621.00, rate: 0.075 },
  { limit: 2902.84, rate: 0.09 },
  { limit: 4354.27, rate: 0.12 },
  { limit: 8475.55, rate: 0.14 }
];

const DEPENDENT_VALUE = 189.59;
const SIMPLIFIED_DEDUCTION = 607.20;

// --- Helper Functions ---
const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const calculateINSS = (grossSalary: number, isClt: boolean, table: typeof INSS_TABLE_2025) => {
  if (!isClt) return 0;
  
  let totalInss = 0;
  const teto = table[table.length - 1].limit;
  let remainingSalary = Math.min(grossSalary, teto);
  let previousLimit = 0;

  for (const range of table) {
    const currentLimit = range.limit;
    const taxableAmount = Math.min(remainingSalary, currentLimit) - previousLimit;
    
    if (taxableAmount > 0) {
      totalInss += taxableAmount * range.rate;
    }
    
    if (remainingSalary <= currentLimit) break;
    previousLimit = currentLimit;
  }

  return totalInss;
};

// Adjusted IRRF calculation according to user provided logic
const calculateIRRF = (salarioBruto: number, descontoINSS: number, numDependentes: number = 0, applyReduction: boolean = false) => {
  // 1. Definition of Initial Calculation Base
  // Check which is more advantageous: Dependents vs Simplified Deduction
  const deducaoDependentes = numDependentes * DEPENDENT_VALUE;
  const baseComDependentes = salarioBruto - descontoINSS - deducaoDependentes;
  const baseSimplificada = salarioBruto - SIMPLIFIED_DEDUCTION;
  
  // Choose the smallest taxable base (which results in less tax)
  const baseIR = Math.min(baseComDependentes, baseSimplificada);

  let impostoTeorico = 0;
  let appliedRate = 0;

  // 2. Progressive Table Calculation
  if (baseIR <= 2428.80) {
    impostoTeorico = 0;
    appliedRate = 0;
  } else if (baseIR <= 2826.65) {
    impostoTeorico = (baseIR * 0.075) - 182.16;
    appliedRate = 7.5;
  } else if (baseIR <= 3751.05) {
    impostoTeorico = (baseIR * 0.15) - 394.16;
    appliedRate = 15;
  } else if (baseIR <= 4664.68) {
    impostoTeorico = (baseIR * 0.225) - 675.49;
    appliedRate = 22.5;
  } else {
    impostoTeorico = (baseIR * 0.275) - 908.73;
    appliedRate = 27.5;
  }

  impostoTeorico = Math.max(0, impostoTeorico);

  // 3. Application of Reduction (ONLY FOR 2026/applyReduction flag)
  let reducaoAdicional = 0;
  if (applyReduction) {
    const rendimentoTributavel = salarioBruto;
    if (rendimentoTributavel <= 5000.00) {
      reducaoAdicional = impostoTeorico; 
    } else if (rendimentoTributavel <= 7350.00) {
      // Formula: 978,62 - (0,133145 * Rendimento)
      reducaoAdicional = 978.62 - (0.133145 * rendimentoTributavel);
    } else {
      reducaoAdicional = 0;
    }
  }

  const impostoFinal = impostoTeorico - Math.max(0, reducaoAdicional);

  return {
    value: Math.round(Math.max(0, impostoFinal) * 100) / 100,
    rate: appliedRate,
    reduction: Math.round(Math.max(0, reducaoAdicional) * 100) / 100
  };
};

// --- Components ---

const Logo = () => (
  <div className="flex items-center gap-3">
    <div className="bg-brand-card p-2 rounded-xl shadow-glow border border-gray-800">
      <Calculator className="w-8 h-8 text-brand-green" />
    </div>
    <div className="flex flex-col">
      <span className="text-3xl font-bold tracking-tight text-white leading-none">Vírgula</span>
      <span className="text-xs font-bold tracking-[0.2em] text-brand-green uppercase mt-1">Contábil</span>
    </div>
  </div>
);

const App = () => {
  const [salary, setSalary] = useState<string>('5000,00');
  const [dependents, setDependents] = useState<number>(0);
  const [otherDiscounts, setOtherDiscounts] = useState<string>('0,00');
  const [isClt, setIsClt] = useState<boolean>(true);
  const [showTables, setShowTables] = useState<boolean>(false);
  const [isCalculated, setIsCalculated] = useState<boolean>(false);

  const numericSalary = parseFloat(salary.replace(/\./g, '').replace(',', '.')) || 0;
  const numericOtherDiscounts = parseFloat(otherDiscounts.replace(/\./g, '').replace(',', '.')) || 0;

  const comparisonData = useMemo(() => {
    // 2025 Calc: standard INSS + standard IRRF (no reduction)
    const inss25 = calculateINSS(numericSalary, isClt, INSS_TABLE_2025);
    const irrf25 = calculateIRRF(numericSalary, inss25, dependents, false);
    const net25 = numericSalary - inss25 - irrf25.value - numericOtherDiscounts;

    // 2026 Calc: updated INSS + updated IRRF (with reduction rule)
    const inss26 = calculateINSS(numericSalary, isClt, INSS_TABLE_2026);
    const irrf26 = calculateIRRF(numericSalary, inss26, dependents, true);
    const net26 = numericSalary - inss26 - irrf26.value - numericOtherDiscounts;

    return {
      gross: numericSalary,
      other: numericOtherDiscounts,
      y25: { inss: inss25, irrf: irrf25.value, net: net25, irrfRate: irrf25.rate, reduction: irrf25.reduction },
      y26: { inss: inss26, irrf: irrf26.value, net: net26, irrfRate: irrf26.rate, reduction: irrf26.reduction }
    };
  }, [numericSalary, dependents, numericOtherDiscounts, isClt]);

  const handleCalculate = () => {
    setIsCalculated(true);
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const scrollToTables = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowTables(true);
    setTimeout(() => {
      document.getElementById('tables-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="container mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-8">
        <Logo />
        <nav className="flex items-center gap-6 text-sm font-medium text-gray-400">
          <button onClick={scrollToTables} className="hover:text-brand-green transition-colors">
            Tabelas
          </button>
          <a 
            href="https://www.virgulacontabil.com.br" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="bg-brand-green text-black px-5 py-2 rounded-full font-bold hover:brightness-110 transition-all"
          >
            Fale Conosco
          </a>
        </nav>
      </header>

      <main className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left: Input Form */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-brand-card rounded-3xl p-8 border border-gray-800 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-brand-green" />
              Entrada de Dados
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-3">Tipo de Contratação</label>
                <div className="grid grid-cols-2 bg-gray-900/50 p-1 rounded-2xl border border-gray-800">
                  <button 
                    onClick={() => { setIsClt(true); setIsCalculated(false); }}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${isClt ? 'bg-brand-green text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    <Briefcase size={18} />
                    CLT
                  </button>
                  <button 
                    onClick={() => { setIsClt(false); setIsCalculated(false); }}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${!isClt ? 'bg-brand-green text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    <User size={18} />
                    Autônomo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">Salário Bruto Mensal</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                  <input 
                    type="text" 
                    value={salary}
                    onChange={(e) => { setSalary(e.target.value); setIsCalculated(false); }}
                    className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-4 pl-12 pr-4 text-xl font-bold focus:outline-none focus:border-brand-green transition-all group-hover:border-gray-700"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Dependentes</label>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => { setDependents(Math.max(0, dependents - 1)); setIsCalculated(false); }}
                      className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center font-bold text-lg hover:bg-gray-800 transition-colors"
                    >-</button>
                    <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl py-2 text-center text-lg font-bold">
                      {dependents}
                    </div>
                    <button 
                      onClick={() => { setDependents(dependents + 1); setIsCalculated(false); }}
                      className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center font-bold text-lg hover:bg-gray-800 transition-colors"
                    >+</button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Demais Descontos</label>
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">R$</span>
                    <input 
                      type="text" 
                      value={otherDiscounts}
                      onChange={(e) => { setOtherDiscounts(e.target.value); setIsCalculated(false); }}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl py-2.5 pl-8 pr-3 text-lg font-bold focus:outline-none focus:border-brand-green transition-all group-hover:border-gray-700"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleCalculate}
                className="w-full bg-brand-green hover:bg-emerald-400 text-black py-4 rounded-2xl font-black text-lg shadow-glow transition-all flex items-center justify-center gap-2 group"
              >
                <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                CALCULAR
              </button>
            </div>
          </div>
        </section>

        {/* Right: Results Comparison */}
        <section id="results-section" className="lg:col-span-8">
          {!isCalculated ? (
            <div className="bg-brand-card/50 rounded-3xl p-12 border-2 border-dashed border-gray-800 h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-6">
                <ArrowRightLeft className="w-10 h-10 text-gray-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-500 mb-2">Pronto para Comparar</h3>
              <p className="text-gray-600 max-w-xs">Clique no botão para comparar os descontos e o salário líquido de 2025 com a nova projeção de 2026.</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 2025 Card - Muted */}
                <div className="bg-brand-card/80 rounded-3xl p-6 border border-gray-800 flex flex-col opacity-90">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-gray-500 font-bold uppercase tracking-widest text-xs">Referência 2025</span>
                  </div>
                  <div className="text-center mb-8">
                    <span className="text-gray-400 text-sm block mb-1">Salário Líquido</span>
                    <div className="text-4xl font-black text-white">{formatCurrency(comparisonData.y25.net)}</div>
                  </div>
                  <div className="space-y-4 border-t border-gray-800 pt-6 flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">INSS</span>
                      <span className="font-bold text-red-400">-{formatCurrency(comparisonData.y25.inss)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">IRRF ({comparisonData.y25.irrfRate.toFixed(1)}%)</span>
                      <span className="font-bold text-red-400">-{formatCurrency(comparisonData.y25.irrf)}</span>
                    </div>
                    {comparisonData.other > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Outros</span>
                        <span className="font-bold text-red-400">-{formatCurrency(comparisonData.other)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-800/50">
                      <span className="text-gray-500 text-xs">Total Descontos</span>
                      <span className="text-gray-300 font-bold">{formatCurrency(comparisonData.y25.inss + comparisonData.y25.irrf + comparisonData.other)}</span>
                    </div>
                  </div>
                </div>

                {/* 2026 Card - Highlighted */}
                <div className="bg-brand-card rounded-3xl p-6 border-2 border-brand-green shadow-glow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 bg-brand-green text-black font-black text-[10px] px-4 py-1 rounded-bl-xl uppercase tracking-tighter">
                    Destaque 2026
                  </div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-brand-green font-bold uppercase tracking-widest text-xs">Projeção 2026</span>
                  </div>
                  <div className="text-center mb-8">
                    <span className="text-gray-400 text-sm block mb-1">Salário Líquido Estimado</span>
                    <div className="text-5xl font-black text-brand-green drop-shadow-[0_0_10px_rgba(0,255,163,0.3)]">
                      {formatCurrency(comparisonData.y26.net)}
                    </div>
                  </div>
                  <div className="space-y-4 border-t border-gray-800 pt-6 flex-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">INSS (Atualizado)</span>
                        <Info size={12} className="text-brand-green cursor-help" />
                      </div>
                      <span className="font-bold text-red-400">-{formatCurrency(comparisonData.y26.inss)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">IRRF ({comparisonData.y26.irrfRate.toFixed(1)}%)</span>
                      <span className="font-bold text-red-400">-{formatCurrency(comparisonData.y26.irrf)}</span>
                    </div>
                    {comparisonData.other > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Outros</span>
                        <span className="font-bold text-red-400">-{formatCurrency(comparisonData.other)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-800/50">
                      <span className="text-gray-400 text-xs">Total Descontos 2026</span>
                      <span className="text-white font-bold">{formatCurrency(comparisonData.y26.inss + comparisonData.y26.irrf + comparisonData.other)}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Common Info Footer */}
              <div className="bg-brand-card p-6 rounded-3xl border border-gray-800 flex flex-wrap gap-8 items-center justify-between">
                <div className="flex gap-8">
                  <div>
                    <span className="text-xs text-gray-500 uppercase block font-bold mb-1">Salário Bruto</span>
                    <span className="text-lg font-bold text-white">{formatCurrency(comparisonData.gross)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase block font-bold mb-1">Dependentes</span>
                    <span className="text-lg font-bold text-white">{dependents}</span>
                  </div>
                </div>
                {comparisonData.y26.reduction > 0 && (
                  <div className="flex items-center gap-3 bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20">
                    <TrendingDown className="text-emerald-400" size={18} />
                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-tight">Redução Lei 15.270: {formatCurrency(comparisonData.y26.reduction)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Reference Tables */}
      <section id="tables-section" className="container mx-auto px-6 mt-16">
        <button 
          onClick={() => setShowTables(!showTables)}
          className="w-full flex items-center justify-between p-6 bg-brand-card rounded-3xl border border-gray-800 hover:border-brand-green/30 transition-all"
        >
          <span className="text-lg font-bold flex items-center gap-2">
            <Info size={20} className="text-brand-green" />
            Detalhes das Tabelas Progressivas
          </span>
          {showTables ? <ChevronUp /> : <ChevronDown />}
        </button>

        {showTables && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* INSS 2025 */}
            <div className="bg-brand-card/50 rounded-3xl p-6 border border-gray-800">
              <h3 className="text-md font-bold mb-4 text-gray-400">INSS 2025 (Referência)</h3>
              <table className="w-full text-xs text-left">
                <tbody className="text-gray-500">
                  {INSS_TABLE_2025.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2">Até {formatCurrency(r.limit)}</td>
                      <td className="py-2 text-right">{(r.rate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* INSS 2026 - Highlighted Table */}
            <div className="bg-brand-card rounded-3xl p-6 border border-brand-green/30 shadow-glow">
              <h3 className="text-md font-bold mb-4 text-brand-green">Nova Tabela INSS 2026</h3>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="pb-2">Faixas de Salário</th>
                    <th className="pb-2 text-right">Taxa</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {INSS_TABLE_2026.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-3">
                        {i === 0 ? `Até ${formatCurrency(r.limit)}` : `De ${formatCurrency(INSS_TABLE_2026[i-1].limit + 0.01)} até ${formatCurrency(r.limit)}`}
                      </td>
                      <td className="py-3 text-right font-bold text-brand-green">{(r.rate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-[10px] text-gray-500 italic">Teto máximo 2026 projetado em {formatCurrency(INSS_TABLE_2026[3].limit)}</p>
            </div>
            
            {/* IRRF Rules Summary */}
            <div className="md:col-span-2 bg-brand-card/30 rounded-3xl p-6 border border-gray-800 text-sm">
              <h3 className="font-bold text-brand-green mb-3">Resumo da Tributação de IRRF (A partir de 2026)</h3>
              <div className="grid md:grid-cols-2 gap-6 text-gray-400">
                <div className="space-y-2">
                  <p><strong className="text-white">Rendimentos até R$ 5.000,00:</strong> Isenção total garantida via redução do imposto devido.</p>
                  <p><strong className="text-white">Rendimentos até R$ 7.350,00:</strong> Redução linear conforme fórmula legal: <code className="text-brand-green">978,62 - (0,133145 * Salário)</code>.</p>
                </div>
                <div className="space-y-2">
                  <p><strong className="text-white">Deduções:</strong> Manutenção do desconto simplificado (R$ 607,20) ou por dependente (R$ 189,59), utilizando sempre o mais vantajoso.</p>
                  <p><strong className="text-white">Fonte:</strong> Lei 15.270/2025.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="container mx-auto px-6 mt-20 pt-10 border-t border-gray-900 text-center">
        <Logo />
        <p className="text-gray-500 text-xs mt-4">
          Vírgula Contábil Edições de Periódicos LTDA. <br />
          Simulação de referência técnica para planejamento contábil.
        </p>
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}