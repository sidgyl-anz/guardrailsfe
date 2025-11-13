
# Safe Health Chat

Safe Health Chat is a responsive, secure, health-focused chat application built with Next.js and Firebase. It leverages the Perplexity AI API to provide users with safe and informative answers to their health-related questions. The application features user authentication, persistent chat history, configurable information source filtering, integrated safety guardrails, and rich inline citations

## Features

- **User Authentication**: Secure sign-up and login using Firebase Authentication (email/password).
- **Persistent Chat History**: Conversations are automatically saved to Firestore for each user. Users can view, resume, and delete past conversations from a collapsible sidebar.
- **Health-Focused AI Chat**: A clean chat interface for interacting with the Perplexity AI API (`sonar-pro` model).
- **Configurable Information Sources**: Users can restrict the AI's search to specific trusted domains (e.g., `medlineplus.gov`).
- **Safety Guardrails**: All user inputs and AI outputs are processed by an external guardrail service to ensure safety and appropriateness. Blocked messages are clearly indicated.
- **Rich Inline Citations**: AI responses include inline citations `[1][2]` that, on click, reveal a popover with links to the source articles.
- **Developer Debug View**: A collapsible panel shows the raw JSON for the last API request and response, aiding in development and debugging.
- **Responsive Design**: The UI is built with ShadCN UI and Tailwind CSS, ensuring a great experience on both desktop and mobile devices.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **UI Library**: [React](https://reactjs.org/) with [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [ShadCN UI](https://ui.shadcn.com/)
- **Backend**: [Firebase](https://firebase.google.com/) (Authentication, Firestore)
- **AI Orchestration**: [Genkit](https://firebase.google.com/docs/genkit)
- **AI Model**: [Perplexity AI](https://perplexity.ai/)
- **State Management**: React Hooks and component state.

## Architecture & Project Structure

The application follows a standard Next.js App Router structure, with Firebase integration for backend services.

```
.
├── src
│   ├── app
│   │   ├── api/guardrails/route.ts   # Backend proxy for the guardrails service
│   │   ├── globals.css               # Global styles and Tailwind directives
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # The main chat page component
│   │
│   ├── components
│   │   ├── ui/                       # ShadCN UI components
│   │   ├── auth-dialog.tsx           # Login/Sign-up modal
│   │   ├── chat-message.tsx          # Renders a single chat message
│   │   ├── conversation-history.tsx  # Sidebar for managing conversations
│   │   ├── debug-view.tsx            # Displays API request/response JSON
│   │   ├── guardrail-result-dialog.tsx # Dialog to show raw guardrail JSON
│   │   ├── settings-dialog.tsx       # Dialog for managing settings
│   │   └── user-menu.tsx             # Dropdown menu for authenticated user
│   │
│   ├── firebase
│   │   ├── client-provider.tsx       # Provides Firebase context to the client
│   │   ├── config.ts                 # Firebase project configuration
│   │   ├── firestore/                # Firestore-related hooks (useCollection)
│   │   └── index.ts                  # Firebase initialization and exports
│   │
│   ├── hooks
│   │   ├── use-settings.ts           # Custom hook to manage and persist user settings
│   │   └── use-toast.ts              # Custom hook for displaying toast notifications
│   │
│   ├── lib
│   │   └── types.ts                  # TypeScript type definitions
│   │
│   └── ai
│       ├── flows/chat.ts             # Genkit flow to call the Perplexity AI API
│       └── genkit.ts                 # Genkit initialization and configuration
│
├── .env                              # Environment variables (for API keys)
├── firestore.rules                   # Firestore security rules
├── next.config.ts                    # Next.js configuration
└── tailwind.config.ts                # Tailwind CSS configuration
```

### Key Components

- **`src/app/page.tsx`**: The main client component that manages the chat state, user input, and orchestrates calls to the AI, guardrails, and Firestore.
- **`src/firebase/*`**: This directory contains all Firebase-related logic, including initialization, authentication hooks (`useUser`, `useAuth`), and real-time Firestore hooks (`useCollection`).
- **`src/components/conversation-history.tsx`**: A stateful component that fetches and displays the user's conversation history from Firestore, allowing them to switch between or delete chats.
- **`src/ai/flows/chat.ts`**: A server-side Genkit flow that acts as a secure wrapper around the Perplexity AI API. It receives the chat history from the client and forwards the request with the necessary credentials.
- **`src/hooks/use-settings.ts`**: This custom hook manages user-configurable settings. It syncs settings between `localStorage` (for logged-out users) and Firestore (for logged-in users).

## Configuration and Setup

To run this project locally, you need to configure your environment variables and set up Firebase.

### 1. Environment Variables

Create a `.env` file in the root of the project and add your API keys and service URLs:

```.env
PERPLEXITY_API_KEY="your_perplexity_api_key_here"
```

You can get a Perplexity API key from the [Perplexity AI Developer Portal](https://docs.perplexity.ai/).

### 2. Firebase Setup

This project uses Firebase for authentication and Firestore as a database.
1.  Create a new Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2.  Add a new Web App to your project.
3.  Copy the Firebase configuration object and paste it into `src/firebase/config.ts`.
4.  In the Firebase Console, go to **Authentication** -> **Sign-in method** and enable the **Email/Password** provider.
5.  Go to **Firestore Database**, create a database, and start in **Production mode**. You will apply security rules in the next step.

### 3. Firestore Security Rules

Copy the contents of the `firestore.rules` file from this project and paste them into the **Rules** tab of your Firestore database in the Firebase Console. Publish the changes.

### 4. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

### 5. Running the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at `http://localhost:9002`.

## How It Works

1.  A user signs up or logs in via the **`AuthDialog`**. The `useUser` hook provides their authentication state throughout the app.
2.  The `ConversationHistory` component fetches the user's past conversations from `/users/{userId}/conversations` in Firestore.
3.  The user types a message in the `Textarea` on the main page. If no conversation is active, a new one is created in Firestore.
4.  On submission, the user's prompt is optionally sent to the guardrails service.
5.  The safe prompt is written as a new document to `/users/{userId}/conversations/{convoId}/messages`.
6.  The `safeHealthChat` Genkit flow is invoked with the current conversation history.
7.  The flow calls the Perplexity AI API. The AI's response is optionally sent to the guardrails service.
8.  The safe AI response is written as another new message to Firestore.
9.  The `useCollection` hook listens for these changes in real-time, and the UI updates automatically to display the new messages.
