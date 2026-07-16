import { useT } from '../../i18n';
import type { AgentSummary, SkillSummary } from '../../messages';

interface Props {
  agents: AgentSummary[];
  skills: SkillSummary[];
}

export function MostUsedTable({ agents, skills }: Props) {
  const t = useT();

  if (agents.length === 0 && skills.length === 0) return null;

  return (
    <div className="nx-analytics-grid nx-analytics-grid--2col">
      {agents.length > 0 && (
        <div className="nx-analytics-panel">
          <h3 className="nx-analytics-section-title">{t.dashboard.mostUsedAgents}</h3>
          <table className="nx-analytics-table">
            <thead>
              <tr>
                <th>{t.dashboard.tableHeaders.agent}</th>
                <th>{t.dashboard.tableHeaders.runs}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.agentId}>
                  <td>@{a.agentId}</td>
                  <td>{a.totalRuns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {skills.length > 0 && (
        <div className="nx-analytics-panel">
          <h3 className="nx-analytics-section-title">{t.dashboard.mostUsedSkills}</h3>
          <table className="nx-analytics-table">
            <thead>
              <tr>
                <th>{t.dashboard.tableHeaders.skill}</th>
                <th>{t.dashboard.tableHeaders.runs}</th>
              </tr>
            </thead>
            <tbody>
              {skills.map(s => (
                <tr key={s.skillId}>
                  <td>#{s.skillId}</td>
                  <td>{s.totalRuns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
