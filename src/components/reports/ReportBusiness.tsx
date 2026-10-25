import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, UserRound } from 'lucide-react'
import type { ReportSummaryData } from '../../types/reports'
import { buildReportRecommendations, REPORT_INCIDENT_LABELS } from '../../utils/reports'

export default function ReportBusiness({ report }: { report: ReportSummaryData }) {
  const metrics = report.business
  const recommendations = buildReportRecommendations(report)
  const missingImpact = report.serviceImpact.find((item) => item.key === 'unknown')?.value ?? 0
  const duration = metrics.averageResolutionMinutes === null ? '—'
    : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(metrics.averageResolutionMinutes / 60)} giờ`
  const cards = [
    { title: 'Đúng hạn SLA', value: metrics.slaOnTimeRate === null ? '—' : `${metrics.slaOnTimeRate.toFixed(1)}%`,
      note: `${metrics.resolvedOnTime}/${metrics.resolvedSlaEligible} hồ sơ hoàn tất đủ mốc thời gian`, icon: CheckCircle2, color: 'text-emerald-700' },
    { title: 'Thời gian khắc phục TB', value: duration, note: `Từ ghi nhận đến hoàn tất · ${metrics.resolutionSample} hồ sơ hợp lệ`, icon: Clock3, color: 'text-slate-800' },
    { title: 'Đang mở quá hạn', value: metrics.overdueOpen, note: 'So với hạn xử lý tại thời điểm tổng hợp', icon: AlertTriangle, color: 'text-red-700' },
    { title: 'Chưa có phụ trách', value: metrics.unassignedOpen, note: 'Sự cố đang mở chưa được phân công', icon: UserRound, color: 'text-amber-700' },
  ]
  return <>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Hiệu quả xử lý sự cố">
      {cards.map(({ title, value, note, icon: Icon, color }) => <article key={title} className="panel p-4">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500"><h3>{title}</h3><Icon className={`size-4 ${color}`} /></div>
        <p className={`my-2 text-2xl font-bold ${color}`}>{value}</p><p className="text-[11px] leading-relaxed text-slate-500">{note}</p>
      </article>)}
    </section>
    <section className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
      <article className="panel p-4">
        <div className="flex items-center gap-2"><ClipboardList className="size-4 text-water-700" /><h3 className="text-sm font-bold text-slate-800">Việc cần theo dõi</h3></div>
        {recommendations.length ? <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
          {recommendations.map((action) => <li key={action} className="border-l-2 border-amber-300 pl-3">{action}</li>)}
        </ul> : <p className="mt-3 text-sm text-slate-500">{report.summary.incidents === 0 ? 'Chưa có sự cố ghi nhận trong phạm vi này.' : 'Chưa phát hiện việc cần nhắc từ các chỉ số hiện có.'}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded border border-slate-200 px-2 py-1 text-slate-600">Đang mở ưu tiên cao: <strong>{metrics.highPriorityOpen}</strong></span>
          <span className="rounded border border-slate-200 px-2 py-1 text-slate-600">Hoàn tất trễ hạn: <strong>{metrics.resolvedLate}</strong></span>
        </div>
      </article>
      <article className="panel p-4">
        <h3 className="text-sm font-bold text-slate-800">Ảnh hưởng cấp nước trong kỳ</h3>
        <p className="mt-1 text-xs text-slate-500">Theo hồ sơ tiếp nhận; gồm cả sự cố đã hoàn tất.</p>
        <div className="mt-3 space-y-2">
          {['interrupted', 'reduced', 'none', 'unknown'].map((key) => {
            const count = report.serviceImpact.find((item) => item.key === key)?.value ?? 0
            return <div key={key} className="grid grid-cols-[125px_1fr_30px] items-center gap-2 text-xs">
              <span className="text-slate-600">{REPORT_INCIDENT_LABELS[key]}</span>
              <div className="h-2 overflow-hidden rounded bg-slate-100"><div className={`h-full ${key === 'interrupted' ? 'bg-red-500' : key === 'reduced' ? 'bg-amber-500' : key === 'none' ? 'bg-teal-600' : 'bg-slate-300'}`} style={{ width: `${report.summary.incidents ? count / report.summary.incidents * 100 : 0}%` }} /></div>
              <strong className="text-right text-slate-700">{count}</strong>
            </div>
          })}
        </div>
      </article>
    </section>
    <section className="panel p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div><h3 className="text-sm font-bold text-slate-800">Phân loại sự cố</h3>
          {report.incidentType.length ? <div className="mt-3 flex flex-wrap gap-2">{report.incidentType.map((item) => <span key={item.key} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{REPORT_INCIDENT_LABELS[item.key] ?? item.key} <strong className="ml-2 text-slate-900">{item.value}</strong></span>)}</div> : <p className="mt-2 text-xs text-slate-500">Không có hồ sơ trong kỳ.</p>}
        </div>
        <div className="text-xs leading-relaxed text-slate-500"><h3 className="mb-2 text-sm font-bold text-slate-800">Cách tính và độ đầy đủ</h3>
          <p>SLA đúng hạn = hoàn tất trước hoặc đúng hạn / hồ sơ hoàn tất có đủ thời điểm ghi nhận, hoàn tất và hạn xử lý. Không lấy ngày cập nhật thay ngày hoàn tất.</p>
          <p className="mt-1">{metrics.resolvedMissingTiming}/{report.summary.resolvedIncidents} hồ sơ hoàn tất chưa đủ dữ liệu SLA; {missingImpact}/{report.summary.incidents} hồ sơ chưa xác định ảnh hưởng cấp nước. Dấu “—” là chưa có mẫu hợp lệ.</p>
          <p className="mt-1">Sự cố lọc theo ngày ghi nhận, tài sản lọc theo ngày cập nhật. Ngày báo cáo theo giờ Việt Nam (UTC+7); trạng thái phản ánh tại thời điểm tổng hợp.</p>
        </div>
      </div>
    </section>
  </>
}
