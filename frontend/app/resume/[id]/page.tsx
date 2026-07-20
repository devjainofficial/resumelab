import { Flow } from "./flow";

export default function ResumePage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Flow resumeId={params.id} />
    </main>
  );
}
