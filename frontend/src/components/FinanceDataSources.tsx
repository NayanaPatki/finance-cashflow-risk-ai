import { useState, type FormEvent } from "react";
import { Database, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import type { DataSourceStatus } from "../lib/sampleData";

type Props = {
  status: DataSourceStatus;
  apiBaseUrl: string;
  onChanged: () => Promise<void>;
};

export function FinanceDataSources({ status, apiBaseUrl, onChanged }: Props) {
  const [transactionsFile, setTransactionsFile] = useState<File | null>(null);
  const [invoicesFile, setInvoicesFile] = useState<File | null>(null);
  const [openingCash, setOpeningCash] = useState(status.opening_cash);
  const [minimumBuffer, setMinimumBuffer] = useState(status.minimum_cash_buffer);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const request = async (path: string, options?: RequestInit) => {
    const response = await fetch(`${apiBaseUrl}${path}`, options);
    const payload = await response.json() as DataSourceStatus | { detail?: string };
    if (!response.ok) throw new Error("detail" in payload && payload.detail ? payload.detail : "Data import failed.");
    return payload as DataSourceStatus;
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transactionsFile || !invoicesFile) {
      setNotice({ tone: "error", text: "Choose both the transactions and invoices CSV files." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const nextStatus = await request("/data-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions_file_name: transactionsFile.name,
          transactions_csv: await transactionsFile.text(),
          invoices_file_name: invoicesFile.name,
          invoices_csv: await invoicesFile.text(),
          opening_cash: openingCash,
          minimum_cash_buffer: minimumBuffer,
        }),
      });
      setNotice({ tone: "success", text: `${nextStatus.transaction_rows} transactions and ${nextStatus.invoice_rows} invoices imported.` });
      await onChanged();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Data import failed." });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await request("/data-source", { method: "DELETE" });
      setTransactionsFile(null);
      setInvoicesFile(null);
      setNotice({ tone: "success", text: "Bundled demo finance data is active again." });
      await onChanged();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Reset failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="data-layout">
      <aside className="panel source-summary">
        <div className="panel-heading">
          <div><h2>Active Finance Dataset</h2><p>Used by all cash and risk calculations</p></div>
          <span className={`source-badge ${status.source_type}`}>{status.source_type === "demo" ? "Demo" : "CSV"}</span>
        </div>
        <div className="source-name"><Database size={22} /><div><strong>{status.source_label}</strong><span>As of {status.as_of_date}</span></div></div>
        <dl className="source-metrics">
          <div><dt>Transactions</dt><dd>{status.transaction_rows}</dd></div>
          <div><dt>Invoices</dt><dd>{status.invoice_rows}</dd></div>
          <div><dt>Opening cash</dt><dd>{currency(status.opening_cash)}</dd></div>
          <div><dt>Cash buffer</dt><dd>{currency(status.minimum_cash_buffer)}</dd></div>
        </dl>
        <button className="secondary-button" type="button" onClick={() => void handleReset()} disabled={busy || status.source_type === "demo"}><RotateCcw size={16} /> Reset to demo</button>
      </aside>

      <form className="panel import-panel" onSubmit={(event) => void handleUpload(event)}>
        <div className="panel-heading"><div><h2>Upload Finance Exports</h2><p>Replace the active model with bank/ERP extracts</p></div><FileSpreadsheet size={20} /></div>
        <div className="file-grid">
          <label className="file-field"><span>Transactions CSV</span><input type="file" accept=".csv,text/csv" onChange={(event) => setTransactionsFile(event.target.files?.[0] ?? null)} /><small>{transactionsFile?.name ?? "Cash inflows, outflows, actuals and planned items"}</small></label>
          <label className="file-field"><span>Invoices CSV</span><input type="file" accept=".csv,text/csv" onChange={(event) => setInvoicesFile(event.target.files?.[0] ?? null)} /><small>{invoicesFile?.name ?? "Open, paid and disputed customer invoices"}</small></label>
        </div>
        <div className="assumption-grid">
          <label>Opening cash<input type="number" min="1" value={openingCash} onChange={(event) => setOpeningCash(Number(event.target.value))} /></label>
          <label>Minimum cash buffer<input type="number" min="1" value={minimumBuffer} onChange={(event) => setMinimumBuffer(Number(event.target.value))} /></label>
        </div>
        <div className="schema-note">
          <strong>Required transaction fields</strong>
          <code>transaction_id, transaction_date, account, direction, category, counterparty, amount, status, description</code>
          <strong>Required invoice fields</strong>
          <code>invoice_id, customer, issue_date, due_date, amount, amount_paid, payment_date, status</code>
        </div>
        <button className="primary-button" type="submit" disabled={busy || !transactionsFile || !invoicesFile}><Upload size={17} /> {busy ? "Validating" : "Upload and recalculate"}</button>
        {notice && <div className={`notice ${notice.tone}`} role="status">{notice.text}</div>}
      </form>
    </section>
  );
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const currency = (value: number) => currencyFormatter.format(value);