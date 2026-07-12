/*
  Warnings:

  - You are about to drop the column `elevenlabsConversationId` on the `Interview` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Interview" DROP COLUMN "elevenlabsConversationId",
ADD COLUMN     "conversationIds" JSONB NOT NULL DEFAULT '[]';
