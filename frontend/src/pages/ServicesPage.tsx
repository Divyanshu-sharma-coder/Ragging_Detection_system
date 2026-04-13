import { BrainCircuit, Camera, ShieldAlert, ActivitySquare, Siren, Workflow } from "lucide-react";

const serviceCards = [
  {
    title: "Live Threat Classification",
    description:
      "Every sampled camera frame is passed through the trained TensorFlow model to classify Normal vs Ragging behavior in near real-time.",
    icon: BrainCircuit,
  },
  {
    title: "Continuous Camera Monitoring",
    description:
      "The backend camera pipeline keeps collecting frame evidence with controllable frame intervals so the system stays responsive under load.",
    icon: Camera,
  },
  {
    title: "Alert-Ready Safety Signals",
    description:
      "When ragging probability rises, the panel surfaces confidence and risk scores so operators can quickly review and escalate incidents.",
    icon: ShieldAlert,
  },
  {
    title: "Operations Health Tracking",
    description:
      "System status endpoints expose camera availability, model readiness, and active inference state for transparent operations.",
    icon: ActivitySquare,
  },
  {
    title: "Prediction History Timeline",
    description:
      "A rolling table of predictions provides timestamps, labels, and probabilities that support post-incident analysis and reporting.",
    icon: Workflow,
  },
  {
    title: "Rapid Response Workflow",
    description:
      "The control panel allows one-click activation/deactivation of detection pipelines to match real incident response needs.",
    icon: Siren,
  },
];

export function ServicesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">What This Model Does</p>
          <h1 className="mt-3 text-4xl font-bold text-white">Smart Eye Services</h1>
          <p className="mt-4 text-slate-300">
            This system combines computer vision and a trained deep learning classifier to monitor campus video streams, flag
            ragging-like behavior, and provide actionable control in one place.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-700/70">
            <img
              src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
              alt="Monitoring control room"
              className="h-64 w-full object-cover"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {serviceCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <card.icon className="h-5 w-5 text-cyan-300" />
              <h2 className="mt-3 font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{card.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
