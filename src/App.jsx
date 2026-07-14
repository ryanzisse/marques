import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus, Search, Phone, MapPin, X, Trash2, Pencil, Clock,
  Receipt, TrendingUp, Wallet, Banknote, Printer, ArrowLeft, Check
} from 'lucide-react';

// --- Configuração do Supabase ---
const supabaseUrl = 'https://upzfrborwyfvknmvscha.supabase.co';
const supabaseKey = 'sb_publishable_54hqQTAhhwWf2F-7P5I_XA_ZV5gYz7f';
const supabase = createClient(supabaseUrl, supabaseKey);

const PAYMENT_METHODS = ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto', 'Transferência'];

const COLORS = {
  bg: '#F6F5F0',
  surface: '#FFFFFF',
  border: '#E4E1D6',
  ink: '#20231D',
  muted: '#75786C',
  primary: '#1F5D4A',
  primaryDark: '#153F32',
  primaryLight: '#E7F0EA',
  accent: '#C77D2E',
  accentLight: '#F7EBD9',
  danger: '#B3492F',
  dangerLight: '#F6E3DD',
};

const currency = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

const emptyForm = () => ({
  nome: '',
  telefone: '',
  endereco: '',
  valorVenda: '',
  valorPago: '',
  formaPagamento: PAYMENT_METHODS[0],
  data: new Date().toISOString().slice(0, 10),
});

// Converte do formato do banco (snake_case) pro formato usado no app (camelCase)
function fromDb(row) {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone || '',
    endereco: row.endereco || '',
    valorVenda: row.valor_venda,
    valorPago: row.valor_pago,
    formaPagamento: row.forma_pagamento,
    data: row.data,
  };
}

// Converte do formato do app pro formato do banco
function toDb(sale) {
  return {
    nome: sale.nome,
    telefone: sale.telefone,
    endereco: sale.endereco,
    valor_venda: sale.valorVenda,
    valor_pago: sale.valorPago,
    forma_pagamento: sale.formaPagamento,
    data: sale.data,
  };
}

function statusOf(sale) {
  const venda = Number(sale.valorVenda) || 0;
  const pago = Number(sale.valorPago) || 0;
  if (pago <= 0) return { key: 'pendente', label: 'Pendente', color: COLORS.danger, bg: COLORS.dangerLight };
  if (pago >= venda) return { key: 'pago', label: 'Pago', color: COLORS.primary, bg: COLORS.primaryLight };
  return { key: 'parcial', label: 'Parcial', color: COLORS.accent, bg: COLORS.accentLight };
}

export default function App() {
  const [sales, setSales] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [payInputs, setPayInputs] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadSales = useCallback(async () => {
    const { data, error } = await supabase
      .from('vendas')
      .select('*')
      .order('data', { ascending: false });
    if (error) {
      setSaveError('Não foi possível carregar as vendas: ' + error.message);
    } else {
      setSales(data.map(fromDb));
      setSaveError('');
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const totals = useMemo(() => {
    let totalVendas = 0, totalRecebido = 0;
    sales.forEach((s) => {
      const venda = Number(s.valorVenda) || 0;
      const pago = Math.min(Number(s.valorPago) || 0, venda);
      totalVendas += venda;
      totalRecebido += pago;
    });
    return { totalVendas, totalRecebido, totalAReceber: totalVendas - totalRecebido };
  }, [sales]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? sales
      : sales.filter((s) =>
          s.nome.toLowerCase().includes(q) || (s.telefone || '').toLowerCase().includes(q)
        );
    return [...list].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [sales, query]);

  function openNewForm() {
    setForm(emptyForm());
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(sale) {
    setForm({
      nome: sale.nome,
      telefone: sale.telefone || '',
      endereco: sale.endereco || '',
      valorVenda: String(sale.valorVenda ?? ''),
      valorPago: String(sale.valorPago ?? ''),
      formaPagamento: sale.formaPagamento || PAYMENT_METHODS[0],
      data: sale.data || new Date().toISOString().slice(0, 10),
    });
    setEditingId(sale.id);
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError('');
  }

  async function submitForm(e) {
    e.preventDefault();
    const nome = form.nome.trim();
    const venda = parseFloat(form.valorVenda);
    const pagoRaw = form.valorPago === '' ? 0 : parseFloat(form.valorPago);

    if (!nome) return setFormError('Informe o nome do cliente.');
    if (!venda || venda <= 0) return setFormError('Informe um valor de venda válido.');
    if (isNaN(pagoRaw) || pagoRaw < 0) return setFormError('Informe um valor de entrada válido.');
    if (pagoRaw > venda) return setFormError('O valor pago não pode ser maior que o valor da venda.');

    const record = {
      nome,
      telefone: form.telefone.trim(),
      endereco: form.endereco.trim(),
      valorVenda: venda,
      valorPago: pagoRaw,
      formaPagamento: form.formaPagamento,
      data: form.data || new Date().toISOString().slice(0, 10),
    };

    if (editingId) {
      const { error } = await supabase.from('vendas').update(toDb(record)).eq('id', editingId);
      if (error) return setFormError('Erro ao salvar: ' + error.message);
    } else {
      const { error } = await supabase.from('vendas').insert(toDb(record));
      if (error) return setFormError('Erro ao salvar: ' + error.message);
    }

    await loadSales();
    closeForm();
  }

  async function removeSale(id) {
    const { error } = await supabase.from('vendas').delete().eq('id', id);
    if (error) {
      setSaveError('Erro ao excluir: ' + error.message);
    } else {
      await loadSales();
    }
    setConfirmDeleteId(null);
  }

  async function registerPayment(sale) {
    const raw = payInputs[sale.id];
    const valor = parseFloat(raw);
    const venda = Number(sale.valorVenda) || 0;
    const pagoAtual = Number(sale.valorPago) || 0;
    if (!raw || isNaN(valor) || valor <= 0) return;
    const novoPago = Math.min(pagoAtual + valor, venda);

    const { error } = await supabase
      .from('vendas')
      .update({ valor_pago: novoPago })
      .eq('id', sale.id);

    if (error) {
      setSaveError('Erro ao registrar pagamento: ' + error.message);
    } else {
      setPayInputs((prev) => ({ ...prev, [sale.id]: '' }));
      await loadSales();
    }
  }

  if (showReport) {
    return <ReportView sales={sales} totals={totals} onBack={() => setShowReport(false)} />;
  }

  return (
    <div style={{ backgroundColor: COLORS.bg, color: COLORS.ink, minHeight: '100vh' }} className="font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .font-sans { font-family: 'Inter', system-ui, sans-serif; }
        .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        input, select { font-family: 'Inter', system-ui, sans-serif; }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 pb-28 pt-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Receipt size={22} style={{ color: COLORS.primary }} />
          <h1 className="font-display text-xl font-semibold">Controle de Vendas</h1>
        </div>
        <p className="text-sm mb-5" style={{ color: COLORS.muted }}>
          {loaded ? `${sales.length} venda${sales.length === 1 ? '' : 's'} registrada${sales.length === 1 ? '' : 's'}` : 'Carregando...'}
        </p>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatCard icon={<TrendingUp size={16} />} label="Total vendido" value={totals.totalVendas} color={COLORS.ink} />
          <StatCard icon={<Wallet size={16} />} label="Recebido" value={totals.totalRecebido} color={COLORS.primary} />
          <StatCard icon={<Clock size={16} />} label="A receber" value={totals.totalAReceber} color={COLORS.accent} />
        </div>

        {saveError && (
          <div className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: COLORS.dangerLight, color: COLORS.danger }}>
            {saveError}
          </div>
        )}

        {/* Busca + ações */}
        <div className="flex gap-2 mb-4">
          <div
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <Search size={16} style={{ color: COLORS.muted }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente ou telefone"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <button
            onClick={openNewForm}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium text-white shrink-0"
            style={{ backgroundColor: COLORS.primary }}
          >
            <Plus size={16} /> Nova venda
          </button>
        </div>

        <button
          onClick={() => setShowReport(true)}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 mb-6 rounded-xl text-sm font-medium"
          style={{ border: `1px dashed ${COLORS.primary}`, color: COLORS.primary }}
        >
          <Printer size={16} /> Emitir relatório
        </button>

        {/* Formulário */}
        {showForm && (
          <form
            onSubmit={submitForm}
            className="mb-6 p-4 rounded-2xl"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-base">
                {editingId ? 'Editar venda' : 'Nova venda'}
              </h2>
              <button type="button" onClick={closeForm} style={{ color: COLORS.muted }}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <Field label="Nome do cliente">
                <input
                  autoFocus
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                  placeholder="Ex: Maria Souza"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone">
                  <input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: `1px solid ${COLORS.border}` }}
                    placeholder="(11) 91234-5678"
                  />
                </Field>
                <Field label="Data da venda">
                  <input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: `1px solid ${COLORS.border}` }}
                  />
                </Field>
              </div>

              <Field label="Endereço">
                <input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                  placeholder="Rua, número, bairro, cidade"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor da venda (R$)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valorVenda}
                    onChange={(e) => setForm({ ...form, valorVenda: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ border: `1px solid ${COLORS.border}` }}
                    placeholder="0,00"
                  />
                </Field>
                <Field label="Valor pago (entrada)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valorPago}
                    onChange={(e) => setForm({ ...form, valorPago: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ border: `1px solid ${COLORS.border}` }}
                    placeholder="0,00"
                  />
                </Field>
              </div>

              <Field label="Forma de pagamento">
                <select
                  value={form.formaPagamento}
                  onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-white"
                  style={{ border: `1px solid ${COLORS.border}` }}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>

              {formError && (
                <p className="text-sm" style={{ color: COLORS.danger }}>{formError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white mt-1"
                style={{ backgroundColor: COLORS.primary }}
              >
                {editingId ? 'Salvar alterações' : 'Registrar venda'}
              </button>
            </div>
          </form>
        )}

        {/* Lista de vendas */}
        {loaded && filtered.length === 0 && (
          <div
            className="text-center py-14 rounded-2xl"
            style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.muted }}
          >
            <Receipt size={28} className="mx-auto mb-2" style={{ color: COLORS.border }} />
            <p className="text-sm">
              {sales.length === 0 ? 'Nenhuma venda registrada ainda.' : 'Nenhuma venda encontrada.'}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((sale) => {
            const venda = Number(sale.valorVenda) || 0;
            const pago = Math.min(Number(sale.valorPago) || 0, venda);
            const saldo = venda - pago;
            const status = statusOf(sale);
            return (
              <div
                key={sale.id}
                className="p-4 rounded-2xl"
                style={{ backgroundColor: COLORS.surface, borderTop: `2px dashed ${COLORS.border}`, border: `1px solid ${COLORS.border}` }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display font-semibold text-base leading-tight">{sale.nome}</h3>
                  <span
                    className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                    style={{ border: `1.5px dashed ${status.color}`, color: status.color, transform: 'rotate(-3deg)' }}
                  >
                    {status.label}
                  </span>
                </div>

                {(sale.telefone || sale.endereco) && (
                  <div className="mb-3 space-y-1">
                    {sale.telefone && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.muted }}>
                        <Phone size={12} /> {sale.telefone}
                      </div>
                    )}
                    {sale.endereco && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.muted }}>
                        <MapPin size={12} /> {sale.endereco}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-3 font-mono">
                  <MiniStat label="Venda" value={venda} />
                  <MiniStat label="Pago" value={pago} color={COLORS.primary} />
                  <MiniStat label="Saldo" value={saldo} color={saldo > 0 ? COLORS.accent : COLORS.muted} />
                </div>

                <div className="flex items-center justify-between text-xs mb-3" style={{ color: COLORS.muted }}>
                  <span className="flex items-center gap-1">
                    <Banknote size={12} /> {sale.formaPagamento}
                  </span>
                  <span>{sale.data && new Date(sale.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>

                {saldo > 0 && (
                  <div className="flex gap-2 mb-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payInputs[sale.id] || ''}
                      onChange={(e) => setPayInputs((p) => ({ ...p, [sale.id]: e.target.value }))}
                      placeholder="Registrar novo pagamento"
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none font-mono"
                      style={{ border: `1px solid ${COLORS.border}` }}
                    />
                    <button
                      onClick={() => registerPayment(sale)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                      style={{ backgroundColor: COLORS.primaryDark }}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <button
                    onClick={() => openEditForm(sale)}
                    className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
                    style={{ color: COLORS.ink }}
                  >
                    <Pencil size={13} /> Editar
                  </button>

                  {confirmDeleteId === sale.id ? (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs" style={{ color: COLORS.muted }}>Excluir?</span>
                      <button onClick={() => removeSale(sale.id)} className="text-xs font-medium px-2 py-1 rounded-lg text-white" style={{ backgroundColor: COLORS.danger }}>
                        Sim
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-medium px-2 py-1" style={{ color: COLORS.muted }}>
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(sale.id)}
                      className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ml-auto"
                      style={{ color: COLORS.danger }}
                    >
                      <Trash2 size={13} /> Excluir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1" style={{ color: COLORS.muted }}>{label}</span>
      {children}
    </label>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div
      className="p-3 rounded-xl"
      style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
    >
      <div className="flex items-center gap-1 mb-1" style={{ color }}>
        {icon}
      </div>
      <div className="font-mono text-sm font-semibold leading-tight" style={{ color }}>
        {currency(value)}
      </div>
      <div className="text-xs mt-0.5" style={{ color: COLORS.muted }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div className="text-xs" style={{ color: COLORS.muted }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: color || COLORS.ink }}>{currency(value)}</div>
    </div>
  );
}

function ReportView({ sales, totals, onBack }) {
  const now = new Date();
  const sorted = [...sales].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  return (
    <div style={{ backgroundColor: '#EDECE6', minHeight: '100vh' }} className="font-mono py-8 px-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Space+Grotesk:wght@600;700&display=swap');
        .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="max-w-sm mx-auto no-print flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: COLORS.ink }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg text-white"
          style={{ backgroundColor: COLORS.primary }}
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>

      <div
        className="max-w-sm mx-auto p-6"
        style={{ backgroundColor: '#FFFFFF', border: `1px solid ${COLORS.border}` }}
      >
        <div className="text-center mb-4">
          <h1 className="font-display font-bold text-lg tracking-tight">RELATÓRIO DE VENDAS</h1>
          <p className="text-xs mt-1" style={{ color: COLORS.muted }}>
            Emitido em {now.toLocaleDateString('pt-BR')} às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div style={{ borderTop: `1px dashed ${COLORS.border}`, borderBottom: `1px dashed ${COLORS.border}` }} className="py-3 mb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: COLORS.muted }}>RESUMO</p>
          <ReportLine label="TOTAL VENDIDO" value={totals.totalVendas} />
          <ReportLine label="TOTAL RECEBIDO" value={totals.totalRecebido} color={COLORS.primary} />
          <ReportLine label="TOTAL A RECEBER" value={totals.totalAReceber} color={COLORS.accent} />
        </div>

        <p className="text-xs font-semibold mb-2" style={{ color: COLORS.muted }}>
          DETALHAMENTO ({sorted.length} {sorted.length === 1 ? 'VENDA' : 'VENDAS'})
        </p>

        <div className="space-y-2.5 mb-4">
          {sorted.length === 0 && (
            <p className="text-xs" style={{ color: COLORS.muted }}>Nenhuma venda registrada.</p>
          )}
          {sorted.map((s) => {
            const venda = Number(s.valorVenda) || 0;
            const pago = Math.min(Number(s.valorPago) || 0, venda);
            const status = statusOf(s);
            return (
              <div key={s.id} style={{ borderBottom: `1px dotted ${COLORS.border}` }} className="pb-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">{s.nome}</span>
                  <span style={{ color: status.color }}>{status.label.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: COLORS.muted }}>
                  <span>{s.data && new Date(s.data + 'T00:00:00').toLocaleDateString('pt-BR')} · {s.formaPagamento}</span>
                  <span>{currency(venda)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: `1px dashed ${COLORS.border}` }} className="pt-3 text-center">
          <p className="text-xs" style={{ color: COLORS.muted }}>Emitido via Controle de Vendas</p>
        </div>
      </div>
    </div>
  );
}

function ReportLine({ label, value, color }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span>{label}</span>
      <span className="font-semibold" style={{ color: color || COLORS.ink }}>{currency(value)}</span>
    </div>
  );
}
