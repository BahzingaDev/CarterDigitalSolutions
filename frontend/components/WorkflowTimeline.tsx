const workflowSteps = [
  {
    phase: '01',
    title: 'Discovery',
    description:
      'We clarify the outcome, audience, constraints, priorities, and what success should look like.',
    outputs: ['Project goal', 'Service fit', 'Initial scope'],
  },
  {
    phase: '02',
    title: 'Scope & Deposit',
    description:
      'The work is shaped into a clear quote, deposit, milestone plan, and delivery expectation.',
    outputs: ['Written scope', 'Deposit invoice', 'Timeline agreement'],
  },
  {
    phase: '03',
    title: 'Design & Plan',
    description:
      'Structure, content, user flow, technical approach, and acceptance criteria are mapped before build work deepens.',
    outputs: ['Page or feature plan', 'Content checklist', 'Technical direction'],
  },
  {
    phase: '04',
    title: 'Build',
    description:
      'The website, software, automation, or workflow is built in focused stages with progress check-ins.',
    outputs: ['Working version', 'Review points', 'Iteration notes'],
  },
  {
    phase: '05',
    title: 'Review & Refine',
    description:
      'We test the work, tighten details, handle revisions, and prepare everything for handover or launch.',
    outputs: ['Testing pass', 'Final edits', 'Launch checklist'],
  },
  {
    phase: '06',
    title: 'Launch & Support',
    description:
      'The finished work is deployed, handed over, and supported with maintenance or training where needed.',
    outputs: ['Launch', 'Handover notes', 'Support options'],
  },
];

export function WorkflowTimeline() {
  return (
    <div className="workflow-timeline">
      {workflowSteps.map((step) => (
        <article className="workflow-step" key={step.phase}>
          <span className="workflow-step-number">{step.phase}</span>
          <div>
            <h2>{step.title}</h2>
            <p>{step.description}</p>
            <ul>
              {step.outputs.map((output) => (
                <li key={output}>{output}</li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
}
