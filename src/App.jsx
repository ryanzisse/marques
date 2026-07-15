import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus, Search, Phone, MapPin, X, Trash2, Pencil, Clock,
  Receipt, TrendingUp, Wallet, Banknote, Printer, ArrowLeft, Check, Users
} from 'lucide-react';
import logo from './assets/marqueslogo.png';

// --- Configuração do Supabase ---
const supabaseUrl = 'https://upzfrborwyfvknmvscha.supabase.co';
const supabaseKey = 'sb_publishable_54hqQTAhhwWf2F-7P5I_XA_ZV5gYz7f';
const supabase = createClient(supabaseUrl, supabaseKey);

// Vendedores disponíveis. table = nome da tabela no Supabase.
const SELLERS = [
  { id: 'junior', label: 'Junior', table: 'junior' },
  { id: 'aldo', label: 'Aldo', table: 'aldo' },
];

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

function fromDb(row, sellerId) {
  return {
    id: row.id,
    seller: sellerId,
    nome: row.nome,
    telefone: row.telefone || '',
    endereco: row.endereco || '',
    valorVenda: row.valor_venda,
    valorPago: row.valor_pago,
    formaPagamento: row.forma_pagamento,
    data: row.data,
  };
}

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

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
  .font-sans { font-family: 'Inter', system-ui, sans-serif; }
  .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
  .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  input, select { font-family: 'Inter', system-ui, sans-serif; }
`;

export default function App() {
  // seller: null (tela de seleção) | 'junior' | 'aldo' | 'overview'
  const [seller, setSeller] = useState(null);

  if (!seller) {
    return <SellerSelect onSelect={setSeller} />;
  }
  if (seller === 'overview') {
    return <OverviewApp onBack={() => setSeller(null)} />;
  }
  return <SellerApp sellerId={seller} onBack={() => setSeller(null)} />;
}

function SellerSelect({ onSelect }) {
  return (
    <div style={{ backgroundColor: COLORS.bg, color: COLORS.ink, minHeight: '100vh' }} className="font-sans">
      <style>{globalStyles}</style>
      <div style={{ maxWidth: '672px', margin: '0 auto', padding: '32px 20px 128px' }}>
        {/* Espaço reservado para logotipo da Marques */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <img
            src={logo}
            alt="Marques"
            style={{ width: '36px', height: '36px', objectFit: 'contain' }}
          />
        </div>

        <h1 className="font-display text-2xl font-semibold mb-2 text-center">Controle de Vendas</h1>
        <p className="text-sm mb-10 text-center" style={{ color: COLORS.muted }}>
          Selecione o vendedor para continuar
        </p>

        <div className="w-full space-y-4">
          {SELLERS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl text-left transition-transform active:scale-[0.98]"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-display font-semibold text-lg"
                style={{ backgroundColor: COLORS.primaryLight, color: COLORS.primary }}
              >
                {s.label.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-display font-semibold text-base">{s.label}</div>
                <div className="text-xs" style={{ color: COLORS.muted }}>Ver vendas de {s.label}</div>
              </div>
            </button>
          ))}

          <button
            onClick={() => onSelect('overview')}
            className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl text-left transition-transform active:scale-[0.98]"
            style={{ border: `1.5px dashed ${COLORS.primary}`, backgroundColor: 'transparent' }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: COLORS.accentLight, color: COLORS.accent }}
            >
              <Users size={20} />
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-base">Visão Geral</div>
              <div className="text-xs" style={{ color: COLORS.muted }}>Total combinado dos dois vendedores</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App de um único vendedor
// ---------------------------------------------------------------------------
function SellerApp({ sellerId, onBack }) {
  const sellerInfo = SELLERS.find((s) => s.id === sellerId);
  const tableName = sellerInfo.table;

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
      .from(tableName)
      .select('*')
      .order('data', { ascending: false });
    if (error) {
      setSaveError('Não foi possível carregar as vendas: ' + error.message);
    } else {
      setSales(data.map((row) => fromDb(row, sellerId)));
      setSaveError('');
    }
    setLoaded(true);
  }, [tableName, sellerId]);

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
      const { error } = await supabase.from(tableName).update(toDb(record)).eq('id', editingId);
      if (error) return setFormError('Erro ao salvar: ' + error.message);
    } else {
      const { error } = await supabase.from(tableName).insert(toDb(record));
      if (error) return setFormError('Erro ao salvar: ' + error.message);
    }

    await loadSales();
    closeForm();
  }

  async function removeSale(id) {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
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
      .from(tableName)
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
    return (
      <ReportView
        sales={sales}
        totals={totals}
        title={`Relatório — ${sellerInfo.label}`}
        onBack={() => setShowReport(false)}
      />
    );
  }

  return (
    <div style={{ backgroundColor: COLORS.bg, color: COLORS.ink, minHeight: '100vh' }} className="font-sans">
      <style>{globalStyles}</style>
      <div style={{ maxWidth: '672px', margin: '0 auto', padding: '32px 20px 128px' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium px-1 py-2"
            style={{ color: COLORS.muted }}
          >
            <ArrowLeft size={18} /> Trocar vendedor
          </button>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              backgroundColor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <img src={logo} alt="Marques" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          </div>
        </div>

        <div className="flex items-center gap-2.5 mb-2">
          <Receipt size={24} style={{ color: COLORS.primary }} />
          <h1 className="font-display text-2xl font-semibold">{sellerInfo.label}</h1>
        </div>
        <p className="text-sm mb-7" style={{ color: COLORS.muted }}>
          {loaded ? `${sales.length} venda${sales.length === 1 ? '' : 's'} registrada${sales.length === 1 ? '' : 's'}` : 'Carregando...'}
        </p>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
          <StatCard icon={<TrendingUp size={18} />} label="Total vendido" value={totals.totalVendas} color={COLORS.ink} />
          <StatCard icon={<Wallet size={18} />} label="Recebido" value={totals.totalRecebido} color={COLORS.primary} />
          <StatCard icon={<Clock size={18} />} label="A receber" value={totals.totalAReceber} color={COLORS.accent} />
        </div>

        {saveError && (
          <div className="mb-5 text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: COLORS.dangerLight, color: COLORS.danger }}>
            {saveError}
          </div>
        )}

        {/* Busca */}
        <div
          className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl mb-4"
          style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <Search size={18} style={{ color: COLORS.muted }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente ou telefone"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            onClick={openNewForm}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white"
            style={{ backgroundColor: COLORS.primary }}
          >
            <Plus size={18} /> Nova venda
          </button>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold"
            style={{ border: `1.5px dashed ${COLORS.primary}`, color: COLORS.primary }}
          >
            <Printer size={18} /> Emitir relatório
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <form
            onSubmit={submitForm}
            className="mb-8 p-6 rounded-2xl"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-lg">
                {editingId ? 'Editar venda' : 'Nova venda'}
              </h2>
              <button type="button" onClick={closeForm} style={{ color: COLORS.muted }} className="p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              <Field label="Nome do cliente">
                <input
                  autoFocus
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                  placeholder="Ex: Maria Souza"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Telefone">
                  <input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${COLORS.border}` }}
                    placeholder="(11) 91234-5678"
                  />
                </Field>
                <Field label="Data da venda">
                  <input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${COLORS.border}` }}
                  />
                </Field>
              </div>

              <Field label="Endereço">
                <input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                  placeholder="Rua, número, bairro, cidade"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Valor da venda (R$)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valorVenda}
                    onChange={(e) => setForm({ ...form, valorVenda: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono"
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
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono"
                    style={{ border: `1px solid ${COLORS.border}` }}
                    placeholder="0,00"
                  />
                </Field>
              </div>

              <Field label="Forma de pagamento">
                <select
                  value={form.formaPagamento}
                  onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-white"
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
                className="w-full py-4 rounded-xl text-sm font-semibold text-white mt-1"
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
            className="text-center py-16 rounded-2xl"
            style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.muted }}
          >
            <Receipt size={30} className="mx-auto mb-3" style={{ color: COLORS.border }} />
            <p className="text-sm">
              {sales.length === 0 ? 'Nenhuma venda registrada ainda.' : 'Nenhuma venda encontrada.'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((sale) => {
            const venda = Number(sale.valorVenda) || 0;
            const pago = Math.min(Number(sale.valorPago) || 0, venda);
            const saldo = venda - pago;
            const status = statusOf(sale);
            return (
              <div
                key={sale.id}
                className="p-5 rounded-2xl"
                style={{ backgroundColor: COLORS.surface, borderTop: `2px dashed ${COLORS.border}`, border: `1px solid ${COLORS.border}` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-display font-semibold text-lg leading-tight">{sale.nome}</h3>
                  <span
                    className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded shrink-0"
                    style={{ border: `1.5px dashed ${status.color}`, color: status.color, transform: 'rotate(-3deg)' }}
                  >
                    {status.label}
                  </span>
                </div>

                {(sale.telefone || sale.endereco) && (
                  <div className="mb-4 space-y-1.5">
                    {sale.telefone && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.muted }}>
                        <Phone size={14} /> {sale.telefone}
                      </div>
                    )}
                    {sale.endereco && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.muted }}>
                        <MapPin size={14} /> {sale.endereco}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mb-4 font-mono">
                  <MiniStat label="Venda" value={venda} />
                  <MiniStat label="Pago" value={pago} color={COLORS.primary} />
                  <MiniStat label="Saldo" value={saldo} color={saldo > 0 ? COLORS.accent : COLORS.muted} />
                </div>

                <div className="flex items-center justify-between text-xs mb-4" style={{ color: COLORS.muted }}>
                  <span className="flex items-center gap-1.5">
                    <Banknote size={14} /> {sale.formaPagamento}
                  </span>
                  <span>{sale.data && new Date(sale.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>

                {saldo > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payInputs[sale.id] || ''}
                      onChange={(e) => setPayInputs((p) => ({ ...p, [sale.id]: e.target.value }))}
                      placeholder="Registrar novo pagamento"
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none font-mono"
                      style={{ border: `1px solid ${COLORS.border}` }}
                    />
                    <button
                      onClick={() => registerPayment(sale)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                      style={{ backgroundColor: COLORS.primaryDark }}
                    >
                      <Check size={16} /> Confirmar
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <button
                    onClick={() => openEditForm(sale)}
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg"
                    style={{ color: COLORS.ink }}
                  >
                    <Pencil size={15} /> Editar
                  </button>

                  {confirmDeleteId === sale.id ? (
                    <div className="flex items-center gap-2.5 ml-auto">
                      <span className="text-sm" style={{ color: COLORS.muted }}>Excluir?</span>
                      <button onClick={() => removeSale(sale.id)} className="text-sm font-medium px-3 py-2 rounded-lg text-white" style={{ backgroundColor: COLORS.danger }}>
                        Sim
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-sm font-medium px-3 py-2" style={{ color: COLORS.muted }}>
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(sale.id)}
                      className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg ml-auto"
                      style={{ color: COLORS.danger }}
                    >
                      <Trash2 size={15} /> Excluir
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

// ---------------------------------------------------------------------------
// Visão Geral (Junior + Aldo combinados) — somente leitura / resumo
// ---------------------------------------------------------------------------
function OverviewApp({ onBack }) {
  const [loaded, setLoaded] = useState(false);
  const [bySeller, setBySeller] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const results = {};
      for (const s of SELLERS) {
        const { data, error: err } = await supabase.from(s.table).select('*');
        if (err) {
          setError('Erro ao carregar ' + s.label + ': ' + err.message);
          results[s.id] = [];
        } else {
          results[s.id] = data.map((row) => fromDb(row, s.id));
        }
      }
      setBySeller(results);
      setLoaded(true);
    })();
  }, []);

  const perSellerTotals = useMemo(() => {
    const out = {};
    SELLERS.forEach((s) => {
      const sales = bySeller[s.id] || [];
      let totalVendas = 0, totalRecebido = 0;
      sales.forEach((sale) => {
        const venda = Number(sale.valorVenda) || 0;
        const pago = Math.min(Number(sale.valorPago) || 0, venda);
        totalVendas += venda;
        totalRecebido += pago;
      });
      out[s.id] = { totalVendas, totalRecebido, totalAReceber: totalVendas - totalRecebido, count: sales.length };
    });
    return out;
  }, [bySeller]);

  const grandTotal = useMemo(() => {
    let totalVendas = 0, totalRecebido = 0, count = 0;
    Object.values(perSellerTotals).forEach((t) => {
      totalVendas += t.totalVendas;
      totalRecebido += t.totalRecebido;
      count += t.count;
    });
    return { totalVendas, totalRecebido, totalAReceber: totalVendas - totalRecebido, count };
  }, [perSellerTotals]);

  return (
    <div style={{ backgroundColor: COLORS.bg, color: COLORS.ink, minHeight: '100vh' }} className="font-sans">
      <style>{globalStyles}</style>
      <div style={{ maxWidth: '672px', margin: '0 auto', padding: '32px 20px 128px' }}>
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium px-1 py-2"
            style={{ color: COLORS.muted }}
          >
            <ArrowLeft size={18} /> Trocar vendedor
          </button>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
              backgroundColor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <img
              src={logo}
              alt="Marques"
              style={{ width: '36px', height: '36px', objectFit: 'contain' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 mb-2">
          <Users size={24} style={{ color: COLORS.accent }} />
          <h1 className="font-display text-2xl font-semibold">Visão Geral</h1>
        </div>
        <p className="text-sm mb-7" style={{ color: COLORS.muted }}>
          {loaded ? `${grandTotal.count} venda${grandTotal.count === 1 ? '' : 's'} no total` : 'Carregando...'}
        </p>

        {error && (
          <div className="mb-5 text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: COLORS.dangerLight, color: COLORS.danger }}>
            {error}
          </div>
        )}

        {/* Total combinado */}
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: COLORS.muted }}>
            Total combinado
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <StatCard icon={<TrendingUp size={18} />} label="Total vendido" value={grandTotal.totalVendas} color={COLORS.ink} />
            <StatCard icon={<Wallet size={18} />} label="Recebido" value={grandTotal.totalRecebido} color={COLORS.primary} />
            <StatCard icon={<Clock size={18} />} label="A receber" value={grandTotal.totalAReceber} color={COLORS.accent} />
          </div>
        </div>

        {/* Por vendedor */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: COLORS.muted }}>
          Por vendedor
        </p>
        <div className="space-y-4">
          {SELLERS.map((s) => {
            const t = perSellerTotals[s.id] || { totalVendas: 0, totalRecebido: 0, totalAReceber: 0, count: 0 };
            return (
              <div
                key={s.id}
                className="p-5 rounded-2xl"
                style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-display font-semibold"
                      style={{ backgroundColor: COLORS.primaryLight, color: COLORS.primary }}
                    >
                      {s.label.charAt(0)}
                    </div>
                    <div>
                      <div className="font-display font-semibold text-base">{s.label}</div>
                      <div className="text-xs" style={{ color: COLORS.muted }}>
                        {t.count} venda{t.count === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 font-mono">
                  <MiniStat label="Vendido" value={t.totalVendas} />
                  <MiniStat label="Recebido" value={t.totalRecebido} color={COLORS.primary} />
                  <MiniStat label="A receber" value={t.totalAReceber} color={COLORS.accent} />
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
      <span className="block text-xs font-medium mb-2" style={{ color: COLORS.muted }}>{label}</span>
      {children}
    </label>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div
      className="p-5 rounded-2xl"
      style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, minWidth: 0 }}
    >
      <div className="flex items-center gap-1.5 mb-3" style={{ color }}>
        {icon}
      </div>
      <div
        className="font-mono font-semibold leading-tight mb-1"
        style={{ color, fontSize: 'clamp(14px, 4vw, 18px)', wordBreak: 'keep-all' }}
      >
        {currency(value)}
      </div>
      <div className="text-xs" style={{ color: COLORS.muted }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: COLORS.muted }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: color || COLORS.ink }}>{currency(value)}</div>
    </div>
  );
}

function ReportView({ sales, totals, title, onBack }) {
  const now = new Date();
  const sorted = [...sales].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  return (
    <div style={{ backgroundColor: '#EDECE6', minHeight: '100vh' }} className="font-mono py-10 px-5">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Space+Grotesk:wght@600;700&display=swap');
        .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="max-w-sm mx-auto no-print flex items-center justify-between mb-5">
        <button onClick={onBack} className="flex items-center gap-2 text-sm py-2" style={{ color: COLORS.ink }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg text-white"
          style={{ backgroundColor: COLORS.primary }}
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>

      <div
        className="max-w-sm mx-auto p-7"
        style={{ backgroundColor: '#FFFFFF', border: `1px solid ${COLORS.border}` }}
      >
        <div className="text-center mb-5">
          <h1 className="font-display font-bold text-lg tracking-tight">{(title || 'RELATÓRIO DE VENDAS').toUpperCase()}</h1>
          <p className="text-xs mt-2" style={{ color: COLORS.muted }}>
            Emitido em {now.toLocaleDateString('pt-BR')} às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div style={{ borderTop: `1px dashed ${COLORS.border}`, borderBottom: `1px dashed ${COLORS.border}` }} className="py-4 mb-5">
          <p className="text-xs font-semibold mb-3" style={{ color: COLORS.muted }}>RESUMO</p>
          <ReportLine label="TOTAL VENDIDO" value={totals.totalVendas} />
          <ReportLine label="TOTAL RECEBIDO" value={totals.totalRecebido} color={COLORS.primary} />
          <ReportLine label="TOTAL A RECEBER" value={totals.totalAReceber} color={COLORS.accent} />
        </div>

        <p className="text-xs font-semibold mb-3" style={{ color: COLORS.muted }}>
          DETALHAMENTO ({sorted.length} {sorted.length === 1 ? 'VENDA' : 'VENDAS'})
        </p>

        <div className="space-y-3 mb-5">
          {sorted.length === 0 && (
            <p className="text-xs" style={{ color: COLORS.muted }}>Nenhuma venda registrada.</p>
          )}
          {sorted.map((s) => {
            const venda = Number(s.valorVenda) || 0;
            const pago = Math.min(Number(s.valorPago) || 0, venda);
            const status = statusOf(s);
            return (
              <div key={s.id} style={{ borderBottom: `1px dotted ${COLORS.border}` }} className="pb-3">
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

        <div style={{ borderTop: `1px dashed ${COLORS.border}` }} className="pt-4 text-center">
          <p className="text-xs" style={{ color: COLORS.muted }}>Emitido via Controle de Vendas</p>
        </div>
      </div>
    </div>
  );
}

function ReportLine({ label, value, color }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span>{label}</span>
      <span className="font-semibold" style={{ color: color || COLORS.ink }}>{currency(value)}</span>
    </div>
  );
}
