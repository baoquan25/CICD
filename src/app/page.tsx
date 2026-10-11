"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BookOpen, Check, FileText, LoaderCircle, LogOut, MessageSquareText, Scale, Trash2, UploadCloud } from "lucide-react";
import { api, Citation, DocumentItem, User } from "@/lib/api";

const PROCESSING = new Set(["uploaded", "textract_submitted", "textract_processing", "indexing"]);

function Auth({ onSuccess }: { onSuccess: (token: string, user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.auth(register ? "register" : "login", {
        email: form.get("email"), password: form.get("password"),
        ...(register ? { full_name: form.get("full_name") } : {}),
      });
      onSuccess(result.access_token, result.user);
    } catch (err) { setError(err instanceof Error ? err.message : "Có lỗi xảy ra"); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell">
    <section className="auth-story">
      <div className="brand"><Scale size={24}/><span>LegalSight</span></div>
      <p className="eyebrow">VISUAL AUGMENTED GENERATION</p>
      <h1>Đọc hồ sơ pháp lý<br/>như một thằng ngu.</h1>
      <p>Textract nhận dạng tài liệu scan. OpenAI đối chiếu nội dung với ảnh gốc. Pinecone đưa đúng trang cần đọc.</p>
      <div className="trust"><Check size={16}/> Dữ liệu tách biệt theo từng tài khoản</div>
    </section>
    <section className="auth-panel">
      <form className="auth-card" onSubmit={submit}>
        <div className="mark"><Scale/></div>
        <h2>{register ? "Tạo không gian làm việc" : "Chào mừng trở lại"}</h2>
        <p>{register ? "Bắt đầu xây dựng kho tri thức pháp lý." : "Đăng nhập vào kho hồ sơ của bạn."}</p>
        {register && <label>Họ và tên<input name="full_name" required minLength={2}/></label>}
        <label>Email<input name="email" type="email" required autoComplete="email"/></label>
        <label>Mật khẩu<input name="password" type="password" required minLength={8} autoComplete={register ? "new-password" : "current-password"}/></label>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>{busy && <LoaderCircle className="spin"/>}{register ? "Tạo tài khoản" : "Đăng nhập"}</button>
        <button type="button" className="link" onClick={() => setRegister(!register)}>{register ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}</button>
      </form>
    </section>
  </main>;
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { uploaded: "Đã tải", textract_submitted: "Đợi OCR", textract_processing: "Đang OCR", indexing: "Đang lập chỉ mục", ready: "Sẵn sàng", failed: "Lỗi" };
  return <span className={`status ${value}`}>{PROCESSING.has(value) && <LoaderCircle className="spin"/>}{labels[value] || value}</span>;
}

function Dashboard({ token, user, logout }: { token: string; user: User; logout: () => void }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const load = useCallback(async () => { try { setDocuments(await api.documents(token)); } catch (e) { setNotice(e instanceof Error ? e.message : "Không tải được tài liệu"); } }, [token]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!documents.some((item) => PROCESSING.has(item.status))) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [documents, load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try { await api.upload(token, new FormData(event.currentTarget)); event.currentTarget.reset(); await load(); setNotice("Đã gửi tài liệu sang Textract. Worker sẽ xử lý nền."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Tải lên thất bại"); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Xóa file gốc, ảnh trang và vectors của tài liệu này?")) return;
    try { await api.remove(token, id); setSelected((items) => items.filter((item) => item !== id)); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Không xóa được tài liệu"); }
  }
  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setAnswer(""); setCitations([]); setNotice("");
    try {
      const result = await api.ask(token, { question: form.get("question"), matter_code: form.get("matter_code") || null, document_ids: selected, top_k: 6 });
      setAnswer(result.answer); setCitations(result.citations);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Không thể truy vấn"); }
    finally { setBusy(false); }
  }

  return <main className="app-shell">
    <aside>
      <div className="brand"><Scale size={23}/><span>LegalSight</span></div>
      <nav><a className="active"><BookOpen/>Kho tri thức</a><a href="#ask"><MessageSquareText/>Tra cứu VAG</a></nav>
      <div className="profile"><div className="avatar">{user.full_name.charAt(0).toUpperCase()}</div><div><strong>{user.full_name}</strong><small>{user.email}</small></div><button title="Đăng xuất" onClick={logout}><LogOut/></button></div>
    </aside>
    <div className="workspace">
      <header><div><p className="eyebrow">LEGAL KNOWLEDGE WORKSPACE</p><h1>Kho tài liệu pháp lý</h1></div><span className="secure">AWS · S3 · Textract</span></header>
      {notice && <div className="notice">{notice}</div>}
      <div className="grid">
        <section className="card upload-card">
          <div className="section-title"><UploadCloud/><div><h2>Nạp tài liệu</h2><p>PDF scan, PNG, JPEG hoặc TIFF</p></div></div>
          <form onSubmit={upload}>
            <label>Tiêu đề tài liệu<input name="title" required placeholder="Ví dụ: Nghị định 130/2025/NĐ-CP"/></label>
            <label>Mã hồ sơ / vụ việc <span>(không bắt buộc)</span><input name="matter_code" placeholder="Ví dụ: HS-2026-014"/></label>
            <label className="drop"><FileText/><span>Chọn tài liệu từ máy</span><small>Tối đa theo MAX_UPLOAD_MB</small><input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" required/></label>
            <button className="primary" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <UploadCloud/>} Tải lên và xử lý</button>
          </form>
        </section>
        <section className="card documents-card">
          <div className="section-title"><BookOpen/><div><h2>Tài liệu đã nạp</h2><p>{documents.length} tài liệu · chọn để giới hạn phạm vi hỏi</p></div></div>
          <div className="document-list">
            {documents.length === 0 && <div className="empty">Chưa có tài liệu nào.</div>}
            {documents.map((doc) => <article key={doc.id} className={selected.includes(doc.id) ? "selected" : ""}>
              <input type="checkbox" disabled={doc.status !== "ready"} checked={selected.includes(doc.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, doc.id] : selected.filter((id) => id !== doc.id))}/>
              <FileText className="file-icon"/><div className="doc-info"><strong>{doc.title}</strong><small>{doc.matter_code || "Toàn kho"} · {(doc.size_bytes / 1024 / 1024).toFixed(1)} MB {doc.page_count ? `· ${doc.page_count} trang` : ""}</small>{doc.error_message && <em>{doc.error_message}</em>}</div>
              <Status value={doc.status}/><button className="icon-button danger" title="Xóa" onClick={() => void remove(doc.id)}><Trash2/></button>
            </article>)}
          </div>
        </section>
      </div>
      <section className="card ask-card" id="ask">
        <div className="section-title"><MessageSquareText/><div><h2>Tra cứu có đối chiếu ảnh gốc</h2><p>AI chỉ trả lời từ các nguồn đã được lập chỉ mục</p></div></div>
        <form onSubmit={ask} className="ask-form"><textarea name="question" required minLength={3} placeholder="Ví dụ: Nghị định này quy định thẩm quyền của cơ quan nào?"/><input name="matter_code" placeholder="Mã hồ sơ (tùy chọn)"/><button className="primary" disabled={busy}>{busy && <LoaderCircle className="spin"/>}Phân tích</button></form>
        {answer && <div className="answer"><p>{answer}</p><div className="citations">{citations.map((item) => <span key={`${item.document_id}-${item.page}`}>{item.title} · trang {item.page}</span>)}</div><small>Kết quả hỗ trợ nghiên cứu, không thay thế tư vấn pháp lý.</small></div>}
      </section>
    </div>
  </main>;
}

export default function Home() {
  const [session, setSession] = useState<{ token: string; user: User } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = localStorage.getItem("legalsight-session");
      if (raw) try { setSession(JSON.parse(raw)); } catch { localStorage.removeItem("legalsight-session"); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function login(token: string, user: User) { const value = { token, user }; localStorage.setItem("legalsight-session", JSON.stringify(value)); setSession(value); }
  function logout() { localStorage.removeItem("legalsight-session"); setSession(null); }
  return session ? <Dashboard token={session.token} user={session.user} logout={logout}/> : <Auth onSuccess={login}/>;
}
