import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus, Search, Phone, MapPin, X, Trash2, Pencil, Clock,
  Receipt, TrendingUp, Wallet, Banknote, Printer, ArrowLeft, Check, Users, ChevronDown, ChevronUp
} from 'lucide-react';
import logo from './assets/marqueslogo.png';
import jsPDF from 'jspdf';

// --- Dados da empresa (usados no recibo em PDF) ---
const COMPANY = {
  nome: 'MARQUES MÁRMORES E GRANITOS LTDA',
  cnpj: '60.333.603/0001-37',
  endereco: 'Rua Orestes Bigossi, nº 44 – Guriri Norte, São Mateus/ES – CEP 29.946-310',
};

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

// --- CONFIGURAÇÃO DO CAIXA ---
const CAIXA_SENHA = '123456'; // Senha fixa para o Aldo

const currency = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

const emptyForm = () => ({
  nome: '',
  telefone: '',
  endereco: '',
  orcamento: '',
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
    orcamento: row.orcamento || '',
    valorVenda: row.valor_venda,
    valorPago: row.valor_pago,
    formaPagamento: row.forma_pagamento,
    data: row.data,
    pagamentos: Array.isArray(row.pagamentos) ? row.pagamentos : [],
  };
}

function toDb(sale) {
  return {
    nome: sale.nome,
    telefone: sale.telefone,
    endereco: sale.endereco,
    orcamento: sale.orcamento || '',
    valor_venda: sale.valorVenda,
    valor_pago: sale.valorPago,
    forma_pagamento: sale.formaPagamento,
    data: sale.data,
  };
}

function gerarReciboPDF(sale, vendedorLabel) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 56;

  const venda = Number(sale.valorVenda) || 0;
  const pago = Number(sale.valorPago) || 0;
  const saldo = venda - pago;

  // Cabeçalho — dados da empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(COMPANY.nome, marginX, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`CNPJ: ${COMPANY.cnpj}`, marginX, y);
  y += 13;
  doc.text(COMPANY.endereco, marginX, y, { maxWidth: pageWidth - marginX * 2 });
  y += 24;

  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 28;

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('RECIBO DE PAGAMENTO', pageWidth / 2, y, { align: 'center' });
  y += 30;

  // Dados do cliente / venda
  doc.setFontSize(10);
  const linha = (label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || '-'), marginX + 120, y);
    y += 18;
  };

  linha('Vendedor:', vendedorLabel);
  linha('Cliente:', sale.nome);
  linha('Telefone:', sale.telefone);
  linha('Endereço:', sale.endereco);
  if (sale.orcamento) linha('Nº Orçamento:', sale.orcamento);
  linha('Data da venda:', sale.data ? new Date(sale.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-');
  linha('Forma de pagamento:', sale.formaPagamento);

  y += 10;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 24;

  // Resumo financeiro
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RESUMO FINANCEIRO', marginX, y);
  y += 20;
  doc.setFontSize(10);
  linha('Valor da venda:', currency(venda));
  linha('Total pago:', currency(pago));
  linha('Saldo restante:', currency(saldo));

  // Histórico de pagamentos
  const pagamentos = Array.isArray(sale.pagamentos) ? sale.pagamentos : [];
  if (pagamentos.length > 0) {
    y += 10;
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('HISTÓRICO DE PAGAMENTOS', marginX, y);
    y += 20;
    doc.setFontSize(9);
    pagamentos.forEach((p, i) => {
      const dataFmt = p.data ? new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
      doc.setFont('helvetica', 'normal');
      doc.text(`${i + 1}. ${dataFmt} — ${currency(p.valor)} (${p.forma || sale.formaPagamento})`, marginX, y);
      y += 16;
    });
  }

  y += 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, marginX, y);

  const nomeArquivo = `recibo-${sale.nome.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(nomeArquivo);
}

function statusOf(sale) {
  const venda = Number(sale.valorVenda) || 0;
  const pago = Number(sale.valorPago) || 0;
  if (pago <= 0) return { key: 'pendente', label: 'Pendente', color: COLORS.danger, bg: COLORS.dangerLight };
  if (pago >= venda) return { key: 'pago', label: 'Pago', color: COLORS.primary, bg: COLORS.primaryLight };
  return { key: 'parcial', label: 'Parcial', color: COLORS.accent, bg: COLORS.accentLight };
}

// Retorna a data de início do período (ou null para "tudo"), baseada em dias corridos
function getPeriodStart(period) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (period === 'semana') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6); // últimos 7 dias corridos, incluindo hoje
    return d;
  }
  if (period === 'mes') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29); // últimos 30 dias corridos, incluindo hoje
    return d;
  }
  return null;
}

function filterSalesByPeriod(sales, period) {
  const start = getPeriodStart(period);
  if (!start) return sales;
  return sales.filter((s) => {
    if (!s.data) return false;
    const d = new Date(s.data + 'T00:00:00');
    return d >= start;
  });
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
  .font-sans { font-family: 'Inter', system-ui, sans-serif; }
  .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
  .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  input, select { font-family: 'Inter', system-ui, sans-serif; }
`;

// ============================================================
// COMPONENTE: Tela de Senha do Caixa
// ============================================================
function SenhaCaixa({ onSuccess, onCancel }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (senha === CAIXA_SENHA) {
      onSuccess();
    } else {
      setErro('Senha incorreta!');
      setSenha('');
    }
  };

  return (
    <div style={{ backgroundColor: COLORS.bg, color: COLORS.ink, minHeight: '100vh' }} className="font-sans">
      <style>{globalStyles}</style>
      <div style={{ maxWidth: '400px', margin: '0 auto', padding: '80px 20px' }}>
        <div className="text-center mb-8">
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              backgroundColor: COLORS.accentLight,
              border: `2px solid ${COLORS.accent}`,
            }}
          >
            <Wallet size={32} style={{ color: COLORS.accent }} />
          </div>
          <h1 className="font-display text-2xl font-semibold">Dashboard de Caixa</h1>
          <p className="text-sm mt-2" style={{ color: COLORS.muted }}>Digite a senha para acessar</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite a senha"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none text-center"
              style={{ border: `2px solid ${COLORS.border}`, fontSize: '18px', letterSpacing: '4px' }}
              autoFocus
            />
            {erro && <p className="text-sm mt-2 text-center" style={{ color: COLORS.danger }}>{erro}</p>}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: COLORS.accent }}
            >
              Acessar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE: Dashboard de Caixa
// ============================================================
function CashDashboard({ onBack }) {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showFormMov, setShowFormMov] = useState(false);
  const [showFormConta, setShowFormConta] = useState(false);
  const [formMov, setFormMov] = useState({
    tipo: 'entrada',
    valor: '',
    descricao: '',
    categoria: 'Outros',
    data: new Date().toISOString().slice(0, 10),
  });
  const [formConta, setFormConta] = useState({
    descricao: '',
    valor: '',
    dataVencimento: new Date().toISOString().slice(0, 10),
    status: 'pendente',
  });
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Carregar dados do Supabase
  const loadData = useCallback(async () => {
    try {
      // Carregar movimentações
      const { data: movData, error: movError } = await supabase
        .from('caixa_movimentacoes')
        .select('*')
        .order('data', { ascending: false });

      if (movError) throw movError;

      // Carregar contas a pagar
      const { data: contaData, error: contaError } = await supabase
        .from('caixa_contas')
        .select('*')
        .order('dataVencimento', { ascending: true });

      if (contaError) throw contaError;

      setMovimentacoes(movData || []);
      setContasPagar(contaData || []);
      setLoaded(true);
    } catch (err) {
      setErro('Erro ao carregar dados: ' + err.message);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calcular saldo atual
  const saldoAtual = useMemo(() => {
    let saldo = 0;
    movimentacoes.forEach((m) => {
      if (m.tipo === 'entrada') saldo += Number(m.valor);
      else saldo -= Number(m.valor);
    });
    return saldo;
  }, [movimentacoes]);

  const totalContasPagar = useMemo(() => {
    return contasPagar
      .filter((c) => c.status === 'pendente')
      .reduce((acc, c) => acc + Number(c.valor), 0);
  }, [contasPagar]);

  const totalContasPagas = useMemo(() => {
    return contasPagar
      .filter((c) => c.status === 'pago')
      .reduce((acc, c) => acc + Number(c.valor), 0);
  }, [contasPagar]);

  const movFiltradas = useMemo(() => {
    if (filtro === 'todos') return movimentacoes;
    return movimentacoes.filter((m) => m.tipo === filtro);
  }, [movimentacoes, filtro]);

  // Funções CRUD para movimentações
  async function addMovimentacao(e) {
    e.preventDefault();
    const valor = parseFloat(formMov.valor);
    if (!valor || valor <= 0) return setErro('Informe um valor válido');
    if (!formMov.descricao.trim()) return setErro('Informe uma descrição');

    const novaMov = {
      tipo: formMov.tipo,
      valor: valor,
      descricao: formMov.descricao,
      categoria: formMov.categoria,
      data: formMov.data,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('caixa_movimentacoes').insert(novaMov);
    if (error) return setErro('Erro ao salvar: ' + error.message);

    setFormMov({
      tipo: 'entrada',
      valor: '',
      descricao: '',
      categoria: 'Outros',
      data: new Date().toISOString().slice(0, 10),
    });
    setShowFormMov(false);
    setErro('');
    await loadData();
  }

  async function deleteMovimentacao(id) {
    const { error } = await supabase.from('caixa_movimentacoes').delete().eq('id', id);
    if (error) return setErro('Erro ao excluir: ' + error.message);
    setConfirmDeleteId(null);
    await loadData();
  }

  // Funções CRUD para contas
  async function addConta(e) {
    e.preventDefault();
    const valor = parseFloat(formConta.valor);
    if (!valor || valor <= 0) return setErro('Informe um valor válido');
    if (!formConta.descricao.trim()) return setErro('Informe uma descrição');

    const novaConta = {
      descricao: formConta.descricao,
      valor: valor,
      dataVencimento: formConta.dataVencimento,
      status: 'pendente',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('caixa_contas').insert(novaConta);
    if (error) return setErro('Erro ao salvar: ' + error.message);

    setFormConta({
      descricao: '',
      valor: '',
      dataVencimento: new Date().toISOString().slice(0, 10),
      status: 'pendente',
    });
    setShowFormConta(false);
    setErro('');
    await loadData();
  }

  async function toggleContaStatus(id, statusAtual) {
    const novoStatus = statusAtual === 'pendente' ? 'pago' : 'pendente';
    const { error } = await supabase
      .from('caixa_contas')
      .update({ status: novoStatus })
      .eq('id', id);
    if (error) return setErro('Erro ao atualizar: ' + error.message);
    await loadData();
  }

  async function deleteConta(id) {
    const { error } = await supabase.from('caixa_contas').delete().eq('id', id);
    if (error) return setErro('Erro ao excluir: ' + error.message);
    await loadData();
  }

  // Formatar data
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  // Categorias para seleção
  const CATEGORIAS = ['Vendas', 'Fornecedor', 'Funcionário', 'Aluguel', 'Impostos', 'Outros'];

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
            <ArrowLeft size={18} /> Voltar
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
          <Wallet size={24} style={{ color: COLORS.accent }} />
          <h1 className="font-display text-2xl font-semibold">Dashboard de Caixa</h1>
        </div>
        <p className="text-sm mb-7" style={{ color: COLORS.muted }}>
          {loaded ? `${movimentacoes.length} movimentações · ${contasPagar.length} contas` : 'Carregando...'}
        </p>

        {erro && (
          <div className="mb-5 text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: COLORS.dangerLight, color: COLORS.danger }}>
            {erro}
          </div>
        )}

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
          <StatCard
            icon={<Wallet size={18} />}
            label="Saldo Atual"
            value={saldoAtual}
            color={saldoAtual >= 0 ? COLORS.primary : COLORS.danger}
          />
          <StatCard
            icon={<Clock size={18} />}
            label="Contas a Pagar"
            value={totalContasPagar}
            color={COLORS.danger}
          />
          <StatCard
            icon={<Check size={18} />}
            label="Contas Pagas"
            value={totalContasPagas}
            color={COLORS.primary}
          />
        </div>

        {/* Botões de ação rápida */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowFormMov(true)}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white"
            style={{ backgroundColor: COLORS.primary }}
          >
            <Plus size={18} /> Nova Entrada
          </button>
          <button
            onClick={() => {
              setFormMov({ ...formMov, tipo: 'saida' });
              setShowFormMov(true);
            }}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white"
            style={{ backgroundColor: COLORS.danger }}
          >
            <Plus size={18} /> Nova Saída
          </button>
          <button
            onClick={() => setShowFormConta(true)}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold"
            style={{ border: `1.5px dashed ${COLORS.accent}`, color: COLORS.accent }}
          >
            <Receipt size={18} /> Nova Conta
          </button>
        </div>

        {/* Formulário de Movimentação */}
        {showFormMov && (
          <form onSubmit={addMovimentacao} className="mb-6 p-5 rounded-2xl" style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">
                {formMov.tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}
              </h3>
              <button type="button" onClick={() => { setShowFormMov(false); setErro(''); }} style={{ color: COLORS.muted }}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo">
                  <select
                    value={formMov.tipo}
                    onChange={(e) => setFormMov({ ...formMov, tipo: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-white"
                    style={{ border: `1px solid ${COLORS.border}` }}
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </Field>
                <Field label="Data">
                  <input
                    type="date"
                    value={formMov.data}
                    onChange={(e) => setFormMov({ ...formMov, data: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${COLORS.border}` }}
                  />
                </Field>
              </div>

              <Field label="Valor (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMov.valor}
                  onChange={(e) => setFormMov({ ...formMov, valor: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono"
                  style={{ border: `1px solid ${COLORS.border}` }}
                  placeholder="0,00"
                  autoFocus
                />
              </Field>

              <Field label="Descrição">
                <input
                  value={formMov.descricao}
                  onChange={(e) => setFormMov({ ...formMov, descricao: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                  placeholder="Ex: Venda #123, Material, etc."
                />
              </Field>

              <Field label="Categoria">
                <select
                  value={formMov.categoria}
                  onChange={(e) => setFormMov({ ...formMov, categoria: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-white"
                  style={{ border: `1px solid ${COLORS.border}` }}
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </Field>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: formMov.tipo === 'entrada' ? COLORS.primary : COLORS.danger }}
              >
                Lançar {formMov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
              </button>
            </div>
          </form>
        )}

        {/* Formulário de Conta */}
        {showFormConta && (
          <form onSubmit={addConta} className="mb-6 p-5 rounded-2xl" style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">Nova Conta a Pagar</h3>
              <button type="button" onClick={() => { setShowFormConta(false); setErro(''); }} style={{ color: COLORS.muted }}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Descrição">
                <input
                  value={formConta.descricao}
                  onChange={(e) => setFormConta({ ...formConta, descricao: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                  placeholder="Ex: Aluguel, Fornecedor, etc."
                  autoFocus
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Valor (R$)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formConta.valor}
                    onChange={(e) => setFormConta({ ...formConta, valor: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono"
                    style={{ border: `1px solid ${COLORS.border}` }}
                    placeholder="0,00"
                  />
                </Field>
                <Field label="Vencimento">
                  <input
                    type="date"
                    value={formConta.dataVencimento}
                    onChange={(e) => setFormConta({ ...formConta, dataVencimento: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ border: `1px solid ${COLORS.border}` }}
                  />
                </Field>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: COLORS.accent }}
              >
                Adicionar Conta
              </button>
            </div>
          </form>
        )}

        {/* Tabs para alternar entre movimentações e contas */}
        <div className="flex gap-2 mb-4 border-b" style={{ borderColor: COLORS.border }}>
          <button
            onClick={() => setFiltro('todos')}
            className={`px-4 py-2.5 text-sm font-medium transition-all ${filtro === 'todos' ? 'border-b-2' : ''}`}
            style={{
              borderColor: filtro === 'todos' ? COLORS.primary : 'transparent',
              color: filtro === 'todos' ? COLORS.ink : COLORS.muted,
            }}
          >
            Todas
          </button>
          <button
            onClick={() => setFiltro('entrada')}
            className={`px-4 py-2.5 text-sm font-medium transition-all ${filtro === 'entrada' ? 'border-b-2' : ''}`}
            style={{
              borderColor: filtro === 'entrada' ? COLORS.primary : 'transparent',
              color: filtro === 'entrada' ? COLORS.ink : COLORS.muted,
            }}
          >
            Entradas
          </button>
          <button
            onClick={() => setFiltro('saida')}
            className={`px-4 py-2.5 text-sm font-medium transition-all ${filtro === 'saida' ? 'border-b-2' : ''}`}
            style={{
              borderColor: filtro === 'saida' ? COLORS.primary : 'transparent',
              color: filtro === 'saida' ? COLORS.ink : COLORS.muted,
            }}
          >
            Saídas
          </button>
        </div>

        {/* Lista de Movimentações */}
        <div className="space-y-3 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>
            Últimas Movimentações ({movFiltradas.length})
          </p>
          {movFiltradas.length === 0 && (
            <div className="text-center py-8 rounded-2xl" style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.muted }}>
              <p className="text-sm">Nenhuma movimentação encontrada</p>
            </div>
          )}
          {movFiltradas.slice(0, 20).map((mov) => (
            <div
              key={mov.id}
              className="p-4 rounded-2xl flex items-center justify-between"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: mov.tipo === 'entrada' ? COLORS.primaryLight : COLORS.dangerLight,
                      color: mov.tipo === 'entrada' ? COLORS.primary : COLORS.danger,
                    }}
                  >
                    {mov.tipo === 'entrada' ? '+' : '-'}
                  </span>
                  <span className="font-medium text-sm">{mov.descricao}</span>
                  <span className="text-xs ml-auto" style={{ color: COLORS.muted }}>{formatDate(mov.data)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: COLORS.muted }}>
                  <span>Categoria: {mov.categoria}</span>
                  <span className="font-mono font-semibold" style={{ color: mov.tipo === 'entrada' ? COLORS.primary : COLORS.danger }}>
                    {currency(mov.valor)}
                  </span>
                </div>
              </div>
              {confirmDeleteId === mov.id ? (
                <div className="flex items-center gap-2 ml-3">
                  <button onClick={() => deleteMovimentacao(mov.id)} className="text-xs font-medium px-2 py-1 rounded text-white" style={{ backgroundColor: COLORS.danger }}>Sim</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-medium px-2 py-1" style={{ color: COLORS.muted }}>Não</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteId(mov.id)} style={{ color: COLORS.muted }} className="p-1">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Lista de Contas a Pagar - VERSÃO CORRIGIDA */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>
            Contas a Pagar ({contasPagar.length})
          </p>
          {contasPagar.length === 0 && (
            <div className="text-center py-8 rounded-2xl" style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.muted }}>
              <p className="text-sm">Nenhuma conta cadastrada</p>
            </div>
          )}
          {contasPagar.map((conta) => (
            <div
              key={conta.id}
              className="p-4 rounded-2xl"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              {/* Linha 1: Status + Descrição + Valor */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded shrink-0"
                  style={{
                    backgroundColor: conta.status === 'pago' ? COLORS.primaryLight : COLORS.dangerLight,
                    color: conta.status === 'pago' ? COLORS.primary : COLORS.danger,
                  }}
                >
                  {conta.status === 'pago' ? '✓ Pago' : 'Pendente'}
                </span>
                <span className="font-medium text-sm flex-1 truncate">{conta.descricao}</span>
                <span className="font-mono font-semibold text-sm shrink-0" style={{ color: COLORS.ink }}>
                  {currency(conta.valor)}
                </span>
              </div>

              {/* Linha 2: Vencimento + Botões */}
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: COLORS.muted }}>
                  Vence: {formatDate(conta.dataVencimento)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleContaStatus(conta.id, conta.status)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                    style={{
                      backgroundColor: conta.status === 'pendente' ? COLORS.primary : COLORS.accentLight,
                      color: conta.status === 'pendente' ? '#FFFFFF' : COLORS.accent,
                    }}
                  >
                    {conta.status === 'pendente' ? 'Pagar' : 'Desfazer'}
                  </button>
                  <button
                    onClick={() => deleteConta(conta.id)}
                    style={{ color: COLORS.muted }}
                    className="p-1 hover:opacity-60 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function App() {
  const [seller, setSeller] = useState(null);
  const [showCaixa, setShowCaixa] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  // Se estiver no dashboard do caixa
  if (showCaixa) {
    return <CashDashboard onBack={() => setShowCaixa(false)} />;
  }

  // Se estiver na tela de senha
  if (showSenha) {
    return <SenhaCaixa
      onSuccess={() => {
        setShowSenha(false);
        setShowCaixa(true);
      }}
      onCancel={() => setShowSenha(false)}
    />;
  }

  // Se não tiver vendedor selecionado
  if (!seller) {
    return <SellerSelect
      onSelect={setSeller}
      onCaixa={() => setShowSenha(true)}
    />;
  }

  // NOVO: Se for Visão Geral
  if (seller === 'overview') {
    return <OverviewApp onBack={() => setSeller(null)} />;
  }

  // Se for um vendedor específico
  return <SellerApp sellerId={seller} onBack={() => setSeller(null)} />;
}
// ============================================================
// COMPONENTE: Seleção de Vendedor (MODIFICADO)
// ============================================================
function SellerSelect({ onSelect, onCaixa }) {
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

          {/* Botão do Dashboard de Caixa - NOVO */}
          <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <button
              onClick={onCaixa}
              className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl text-left transition-transform active:scale-[0.98]"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: COLORS.accentLight, color: COLORS.accent }}
              >
                <Wallet size={20} />
              </div>
              <div className="flex-1">
                <div className="font-display font-semibold text-base">Dashboard de Caixa</div>
                <div className="text-xs" style={{ color: COLORS.muted }}>Gerenciar entradas, saídas e contas a pagar</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE: App de um único vendedor
// ============================================================
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
  const [payDateInputs, setPayDateInputs] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showSalesList, setShowSalesList] = useState(false);

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
      orcamento: sale.orcamento || '',
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
      orcamento: form.orcamento.trim(),
      valorVenda: venda,
      valorPago: pagoRaw,
      formaPagamento: form.formaPagamento,
      data: form.data || new Date().toISOString().slice(0, 10),
    };

    if (editingId) {
      const { error } = await supabase.from(tableName).update(toDb(record)).eq('id', editingId);
      if (error) return setFormError('Erro ao salvar: ' + error.message);
    } else {
      // Ao criar uma venda nova, se já houver entrada paga, registra no histórico de pagamentos
      const pagamentosIniciais = pagoRaw > 0
        ? [{ valor: pagoRaw, data: record.data, forma: form.formaPagamento }]
        : [];
      const { error } = await supabase
        .from(tableName)
        .insert({ ...toDb(record), pagamentos: pagamentosIniciais });
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
    const dataPagamento = payDateInputs[sale.id] || new Date().toISOString().slice(0, 10);
    const venda = Number(sale.valorVenda) || 0;
    const pagoAtual = Number(sale.valorPago) || 0;
    if (!raw || isNaN(valor) || valor <= 0) return;
    const novoPago = Math.min(pagoAtual + valor, venda);
    const novoHistorico = [
      ...(Array.isArray(sale.pagamentos) ? sale.pagamentos : []),
      { valor, data: dataPagamento, forma: sale.formaPagamento },
    ];

    const { error } = await supabase
      .from(tableName)
      .update({ valor_pago: novoPago, pagamentos: novoHistorico })
      .eq('id', sale.id);

    if (error) {
      setSaveError('Erro ao registrar pagamento: ' + error.message);
    } else {
      setPayInputs((prev) => ({ ...prev, [sale.id]: '' }));
      setPayDateInputs((prev) => ({ ...prev, [sale.id]: '' }));
      await loadSales();
    }
  }

  if (showReport) {
    return (
      <ReportView
        sales={sales}
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

        {/* Ações principais */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
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

              <Field label="Número do orçamento">
                <input
                  value={form.orcamento}
                  onChange={(e) => setForm({ ...form, orcamento: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono"
                  style={{ border: `1px solid ${COLORS.border}` }}
                  placeholder="Ex: 0142"
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

        {/* Alternador — mostrar/ocultar vendas registradas */}
        <button
          onClick={() => setShowSalesList((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-sm font-semibold mb-4"
          style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
        >
          <span className="flex items-center gap-2">
            <Receipt size={18} style={{ color: COLORS.muted }} />
            Vendas registradas ({sales.length})
          </span>
          {showSalesList ? <ChevronUp size={18} style={{ color: COLORS.muted }} /> : <ChevronDown size={18} style={{ color: COLORS.muted }} />}
        </button>

        {showSalesList && (
          <>
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
                        <input
                          type="date"
                          value={payDateInputs[sale.id] || new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setPayDateInputs((p) => ({ ...p, [sale.id]: e.target.value }))}
                          className="px-4 py-2.5 rounded-xl text-sm outline-none"
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

                    <div className="flex items-center gap-3 pt-4 flex-wrap" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <button
                        onClick={() => openEditForm(sale)}
                        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg"
                        style={{ color: COLORS.ink }}
                      >
                        <Pencil size={15} /> Editar
                      </button>

                      <button
                        onClick={() => gerarReciboPDF(sale, sellerInfo.label)}
                        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg"
                        style={{ color: COLORS.primary }}
                      >
                        <Printer size={15} /> Recibo
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
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE: Visão Geral (Junior + Aldo combinados)
// ============================================================
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

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================
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

function ReportView({ sales, title, onBack }) {
  const [period, setPeriod] = useState('tudo');
  const now = new Date();

  const filteredSales = useMemo(() => filterSalesByPeriod(sales, period), [sales, period]);

  const totals = useMemo(() => {
    let totalVendas = 0, totalRecebido = 0;
    filteredSales.forEach((s) => {
      const venda = Number(s.valorVenda) || 0;
      const pago = Math.min(Number(s.valorPago) || 0, venda);
      totalVendas += venda;
      totalRecebido += pago;
    });
    return { totalVendas, totalRecebido, totalAReceber: totalVendas - totalRecebido };
  }, [filteredSales]);

  const sorted = [...filteredSales].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const PERIODS = [
    { key: 'tudo', label: 'Tudo' },
    { key: 'semana', label: 'Últimos 7 dias' },
    { key: 'mes', label: 'Últimos 30 dias' },
  ];

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

      {/* Filtro de período */}
      <div className="max-w-sm mx-auto no-print flex gap-2 mb-5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold"
            style={
              period === p.key
                ? { backgroundColor: COLORS.primary, color: '#fff' }
                : { backgroundColor: COLORS.surface, color: COLORS.muted, border: `1px solid ${COLORS.border}` }
            }
          >
            {p.label}
          </button>
        ))}
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
          {period !== 'tudo' && (
            <p className="text-xs mt-1" style={{ color: COLORS.accent }}>
              Período: {PERIODS.find((p) => p.key === period)?.label}
            </p>
          )}
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
            <p className="text-xs" style={{ color: COLORS.muted }}>Nenhuma venda registrada neste período.</p>
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