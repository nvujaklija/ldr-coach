import BackendStatus from "@/components/BackendStatus";
import CheckInCard from "@/components/CheckInCard";

export default function DashboardPage() {
  return (
    <main>
      <h1>LDR Coach</h1>
      <p>
        Your shared space for staying close across the distance. This is a
        placeholder dashboard for the v0 foundation.
      </p>
      <BackendStatus />
      <CheckInCard />
    </main>
  );
}
