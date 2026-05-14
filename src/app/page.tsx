import { auth } from "../lib/auth";
import { SuperheroLanding } from "./superhero-landing";

export default async function Home() {
  const session = await auth();

  return (
    <SuperheroLanding
      email={session?.user?.email}
      isAuthenticated={Boolean(session?.user)}
    />
  );
}
