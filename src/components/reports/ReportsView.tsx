import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LayerDataState } from '../../types/gis'
import { buildAssetStatusChart, buildIncidentSeverityChart } from '../../utils/metrics'

function buildSixMonthTrend(data: LayerDataState) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    const incidents = data.incidents.features.filter((feature) => {
      const reported = new Date(feature.properties.reportedDate)
      return reported.getFullYear() === date.getFullYear() && reported.getMonth() === date.getMonth()
    }).length

    return {
      month: `T${date.getMonth() + 1}/${String(date.getFullYear()).slice(-2)}`,
      incidents,
    }
  })
}

export default function ReportsView({ data }: { data: LayerDataState }) {
  const assetChart = useMemo(() => buildAssetStatusChart(data), [data])
  const incidentChart = useMemo(() => buildIncidentSeverityChart(data), [data])
  const trendData = useMemo(() => buildSixMonthTrend(data), [data])

  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-2">
      <section className="panel p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Phân bố trạng thái tài sản</p>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={assetChart} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={88} fill="#0ea5e9" label />
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Mức độ nghiêm trọng sự cố</p>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={incidentChart} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={88} fill="#ef4444" label />
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel p-4 lg:col-span-2">
        <p className="mb-3 text-sm font-semibold text-slate-800">Sự cố ghi nhận trong 6 tháng gần nhất</p>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="4 4" stroke="#dbeafe" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="incidents" name="Sự cố" stroke="#dc2626" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
