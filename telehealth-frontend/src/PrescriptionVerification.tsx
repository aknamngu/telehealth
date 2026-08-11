import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useLanguage } from "./i18n";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface VerificationData {
  status: "VALID" | "REVOKED" | "TAMPERED";
  prescriptionId: number;
  verificationCode: string;
  diagnosis: string;
  medicines: string;
  issuedAt: string;
  revokedAt?: string | null;
  appointmentDate: string;
  patientName: string;
  doctorName: string;
  specialty?: string | null;
  signature: string;
}

export default function PrescriptionVerification() {
  const { token = "" } = useParams();
  const { language } = useLanguage();
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/prescriptions/verify/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.message ?? "Invalid prescription");
        if (active) setData(payload.data);
      })
      .catch(
        (reason) =>
          active &&
          setError(reason instanceof Error ? reason.message : String(reason)),
      );
    return () => {
      active = false;
    };
  }, [token]);

  const state = data?.status;
  const statusStyle =
    state === "VALID"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : state === "REVOKED"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-800";
  const StatusIcon =
    state === "VALID"
      ? CheckCircle2
      : state === "REVOKED"
        ? AlertTriangle
        : XCircle;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dff8ff_0,#f8fafc_38%,#eef2ff_100%)] px-4 py-20 text-slate-900">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-200">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-700">
              OS Telehealth
            </p>
            <h1 className="text-2xl font-black">
              {tr(
                "Xác minh đơn thuốc điện tử",
                "Electronic prescription verification",
              )}
            </h1>
          </div>
        </div>

        {!data && !error && (
          <div className="flex items-center justify-center gap-3 rounded-[2rem] bg-white p-16 font-semibold text-slate-600 shadow-xl shadow-slate-200/60">
            <LoaderCircle className="h-6 w-6 animate-spin text-sky-600" />
            {tr(
              "Đang kiểm tra chữ ký kỹ thuật...",
              "Checking technical signature...",
            )}
          </div>
        )}

        {error && (
          <div className="rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
            <XCircle className="mx-auto h-14 w-14 text-rose-500" />
            <h2 className="mt-4 text-xl font-black">
              {tr(
                "Không xác minh được đơn thuốc",
                "Prescription could not be verified",
              )}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
          </div>
        )}

        {data && (
          <article className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl shadow-slate-300/50">
            <div
              className={`flex items-center gap-4 border-b p-6 ${statusStyle}`}
            >
              <StatusIcon className="h-10 w-10 shrink-0" />
              <div>
                <h2 className="text-xl font-black">
                  {state === "VALID"
                    ? tr(
                        "Đơn thuốc hợp lệ và nguyên vẹn",
                        "Prescription is valid and intact",
                      )
                    : state === "REVOKED"
                      ? tr(
                          "Đơn thuốc đã bị thu hồi",
                          "Prescription has been revoked",
                        )
                      : tr(
                          "Cảnh báo: dữ liệu đã bị thay đổi",
                          "Warning: prescription data was altered",
                        )}
                </h2>
                <p className="mt-1 text-sm font-semibold opacity-80">
                  {tr("Mã xác minh", "Verification code")}:{" "}
                  {data.verificationCode}
                </p>
              </div>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <Info
                label={tr("Bệnh nhân", "Patient")}
                value={data.patientName}
              />
              <Info
                label={tr("Bác sĩ kê đơn", "Prescribing doctor")}
                value={data.doctorName}
              />
              <Info
                label={tr("Chuyên khoa", "Specialty")}
                value={data.specialty || "—"}
              />
              <Info
                label={tr("Ngày khám", "Appointment date")}
                value={new Date(data.appointmentDate).toLocaleDateString(
                  language === "vi" ? "vi-VN" : "en-US",
                )}
              />
              <Info
                label={tr("Ngày phát hành", "Issued at")}
                value={new Date(data.issuedAt).toLocaleString(
                  language === "vi" ? "vi-VN" : "en-US",
                )}
              />
              <Info
                label={tr("Mã đơn thuốc", "Prescription ID")}
                value={`#${data.prescriptionId}`}
              />
            </div>

            <div className="space-y-5 border-t border-slate-100 p-6">
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  <FileText className="h-4 w-4" />
                  {tr("Chẩn đoán", "Diagnosis")}
                </h3>
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6">
                  {data.diagnosis}
                </p>
              </section>
              <section>
                <h3 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  {tr("Thuốc và hướng dẫn dùng", "Medicines and directions")}
                </h3>
                <p className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6">
                  {data.medicines}
                </p>
              </section>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-500">SHA-256 HMAC</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-600">
                  {data.signature}
                </p>
              </div>
            </div>
          </article>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          {tr(
            "QR dùng để đối chiếu dữ liệu và trạng thái đơn thuốc trong hệ thống; không thay thế chữ ký số pháp lý được cấp bởi tổ chức chứng thực.",
            "This QR checks prescription data and status in the system; it is not a legally certified digital signature.",
          )}
          {" · "}
          <Link to="/" className="font-bold text-sky-700">
            {tr("Về trang chủ", "Home")}
          </Link>
        </p>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-bold text-slate-800">{value}</p>
    </div>
  );
}
