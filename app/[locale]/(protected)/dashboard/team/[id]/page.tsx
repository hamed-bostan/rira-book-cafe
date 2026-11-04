import { notFound } from "next/navigation";

import { requireOwner } from "@/src/lib/require-admin";
import { teamServerApi } from "@/src/presentation/dashboard/team/team-server-api";
import { TeamMemberSecurityScreen } from "@/src/presentation/dashboard/team/TeamMemberSecurityScreen";

// Sessions are read per request — a browser just signed out must vanish on the next look.
export const dynamic = "force-dynamic";

type TeamMemberPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * `/dashboard/team/:id` — one team member's signed-in sessions, for the owner.
 * Someone not on the team is a 404 (the owner manages the team's access, not every
 * guest's account).
 */
export default async function TeamMemberPage({ params }: TeamMemberPageProps) {
  await requireOwner();
  const id = decodeURIComponent((await params).id);
  const members = await teamServerApi.list();
  const member = members.find((candidate) => candidate.id === id);
  if (!member) notFound();

  const sessions = await teamServerApi.listMemberSessions(member.id);
  return <TeamMemberSecurityScreen member={member} sessions={sessions} />;
}
