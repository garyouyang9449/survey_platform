# Founding Engineer Take-Home Assignment

## Overview
Build a seamless web-based user experience where respondents enter a single interface, complete a screening questionnaire, and are automatically routed to an AI-moderated voice interview tailored to their responses. This assignment tests your ability to:
* Design and orchestrate integrated user experiences
* Implement robust state management and error handling
* Build reliable conversational AI systems with context preservation
* Create production-ready solutions quickly

## What You'll Build:
A unified web application that combines a custom screening survey (with a polished, one-question-at-a-time experience similar to Typeform) and ElevenLabs Conversational AI (for voice interviews) into a seamless end-to-end experience. The key challenge is designing the integration layer, state management, and recovery mechanisms that make this feel like one cohesive product rather than two disconnected tools.

## Part 1: Screening Survey Platform

### Objective
Build a screening survey component with a clean, conversational UI (think Typeform-style: one question at a time, smooth transitions, progress indication). The survey screens and segments respondents into two categories: "BMW Customers" (BMW owners) and "Potential BMW Customers" (Mercedes/Audi owners).

**Critical Feature:** If a respondent leaves and returns, they should be able to resume their survey without re-answering questions (either pre-populated or picking up where they left off).

### Survey Flow
**Question 1: How old are you?**
* Under 18 [Terminate]
* 18-24
* 25-34
* 35-44
* 45-54
* 55-64
* 65+

**Question 2: What is your annual household income?**
* Under $25,000
* $25,000-$49,999
* $50,000-$74,999
* $75,000-$99,999
* $100,000-$149,999
* $150,000+

**Question 3: Do you currently own a car?**
* Yes
* No [Terminate]

**Question 4: Which car brand do you currently own? (Select all that apply)**
* BMW [Qualify: Customer]
* Mercedes-Benz [Qualify: Potential Customer]
* Audi [Qualify: Potential Customer]
* Toyota [Terminate]
* Honda [Terminate]
* Ford [Terminate]
* Tesla [Terminate]
* Other [Terminate]

### Requirements & Deliverables
1. Screening survey with branching logic and a polished, Typeform-style UX, leading to one of three outcomes: (1) Do not qualify, (2) BMW Customer, (3) Potential BMW Customer
2. Session persistence: save survey progress and enable respondents to resume without re-answering questions
3. Unique respondent IDs for session tracking
4. Backend logic to capture, process, and store segmentation data ("BMW Customer" vs "Potential BMW Customer")
5. Smooth transition from survey completion to voice interview
6. Documentation of your integration approach

## Part 2: AI Voice Interview Platform

### Objective
Build a robust voice interview system using Eleven Labs Conversational AI that conducts a 10-15 minute interview with qualified respondents. The system must handle real-world reliability challenges while maintaining conversational quality.

### Interview Script

**Introduction (All Respondents):**
1. "Thank you for participating in our survey. I'm going to ask you 10-15 questions about your car ownership experience. This should take about 10-15 minutes. Are you ready to begin?"

**Core Questions (All Respondents):**
2. "How long have you owned your current vehicle?"
3. "What were the main factors that influenced your decision to purchase this specific brand?"
4. "On a scale of 1 to 10, how satisfied are you with your current vehicle?"
5. "What features or aspects of your car do you value most?"
6. "Have you experienced any issues or concerns with your vehicle?"

**BMW Customers (BMW Owners):**
7. "What made you choose BMW over other luxury brands like Mercedes or Audi?"
8. "How would you rate BMW's customer service and dealership experience?"
9. "Which BMW model do you own, and what do you love most about it?"
10. "How likely are you to purchase another BMW in the future? What would make you consider switching brands?"
11. "What could BMW improve to make your ownership experience even better?"

**Potential BMW Customers (Mercedes/Audi Owners):**
7. "Have you ever considered purchasing a BMW? Why or why not?"
8. "What perceptions or impressions do you have of the BMW brand?"
9. "What would it take for you to switch to BMW for your next vehicle purchase?"
10. "Compared to BMW, what do you think your current brand does better?"
11. "If you were to recommend a luxury car brand to a friend, which would you choose and why?"

**Closing Questions (All Respondents):**
12. "Is there anything else you'd like to share about your vehicle ownership experience?"

### Requirements & Deliverables
1. Web-based voice interview interface (NO phone number) with Eleven Labs integration
2. **Conversation Resumption**
   a. If the call is interrupted or connection breaks, users must be able to resume
   b. When resumed, the AI must preserve full context from the prior conversation
   c. The AI should acknowledge where you left off (e.g., "Welcome back! We were just discussing your vehicle satisfaction...")
3. **Interview Completion Validation**
   a. Track progress through the interview guide
   b. Prevent submission until all required questions have been answered
   c. Provide clear indication of interview progress to the user
4. **Dynamic Question Routing**
   a. Route to segment-specific questions based on Part 1 segmentation
   b. Maintain natural conversation flow despite conditional logic
5. **Transcript Management**
   a. Fetch complete conversation transcript after interview
   b. Store transcript and make it accessible (display or download)
6. Documentation covering your conversation resumption approach, completion validation logic, and architecture decisions

## Integration & User Experience
The Key Challenge: Creating a seamless, single-session experience from survey to interview.
1. User lands on your web application
2. User completes screening survey
3. User is automatically transitioned to the AI-moderated voice interview with the appropriate question set based on their segmentation
4. After interview completion, transcript is stored and accessible

Session persistence should work across both parts if a user leaves and returns at any point, they should pick up where they left off.

## Submission Guidelines
Please submit:
1. Live deployment on Vercel, Railway, or another hosting platform of your choice, with the URL provided
2. GitHub repository shared with martin.li@diligencesquared.com containing source code
3. Brief Write-up (1-2 pages) covering:
   a. Technology choices and why
   b. Challenges faced and how you solved them
   c. What you'd improve with more time
   d. Estimated time spent

**Reimbursements:** Feel free to upgrade your ElevenLabs plan to the lowest paid tier (or higher) if needed. We'll reimburse you. Send over your receipt, bank details, and personal address and we'll process it promptly.

**Presentation:** After you submit, we'll schedule a 45-minute session for a walkthrough, technical deep dive, and QA of your project.

If anything is unclear, please email martin.li@diligencesquared.com with any questions.

## Notes & Tips
* ElevenLabs is prescribed for the voice interview, but the rest of the platform is for you to design. We want to see how you design the survey UX, integration, state management, and overall user experience.
* Conversation resumption is critical. Think carefully about what state needs to be preserved and how to restore it seamlessly.
* Focus on reliability and edge cases. What happens when things go wrong? How do you ensure interviews don't get lost?
* Production-ready doesn't mean perfect. We value working solutions over unfinished perfection.
* We value UI. Great UX/UI demonstrates your attention to detail and user-centric thinking. The experience should feel polished and seamless.
* Document your trade-offs. We want to understand your decision-making process and what you'd prioritize with more time.
* Test thoroughly. Make sure all paths work, including interruptions, resumptions, and screen-outs.

Good luck! We're excited to see what you build.
