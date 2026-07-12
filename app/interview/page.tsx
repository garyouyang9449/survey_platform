"use client";

import { ConversationProvider } from "@elevenlabs/react";
import { Interview } from "@/components/interview/Interview";

export default function InterviewPage() {
  return (
    <ConversationProvider>
      <Interview />
    </ConversationProvider>
  );
}
