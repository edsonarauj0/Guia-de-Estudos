import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SubjectStat } from '@/types';

interface SubjectProgressChartProps {
  stats: SubjectStat[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-sm">
        <p className="font-medium text-foreground mb-1">{label}</p>
        <p className="text-muted-foreground">Progresso: <span className="text-foreground font-medium">{payload[0].value}%</span></p>
      </div>
    );
  }
  return null;
};

export default function SubjectProgressChart({ stats }: SubjectProgressChartProps) {
  const data = useMemo(() => {
    return stats.map(s => ({
      name: s.subject.name.length > 12 ? s.subject.name.slice(0, 12) + '…' : s.subject.name,
      fullName: s.subject.name,
      progress: s.progressPercent,
      color: s.subject.color,
    }));
  }, [stats]);

  return (
    <div className="glass rounded-2xl p-6">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">Progresso por Matéria</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
          <Bar dataKey="progress" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
