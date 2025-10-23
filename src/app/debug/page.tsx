
"use client";

import { DebugView } from "@/components/debug-view";
import { useApiTransaction } from "@/context/api-transaction-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function DebugPage() {
  const { lastApiTransaction } = useApiTransaction();

  return (
    <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
       <div className="max-w-4xl mx-auto">
        <div className="mb-4">
            <Button asChild variant="outline" size="sm">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Chat
                </Link>
            </Button>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>API Debug View</CardTitle>
                <CardDescription>
                    This page shows the raw JSON data for the most recent API transaction.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {lastApiTransaction ? (
                    <DebugView 
                        request={lastApiTransaction.request}
                        response={lastApiTransaction.response}
                    />
                ) : (
                    <div className="text-center text-muted-foreground py-12">
                        <p>No API transaction has been recorded yet.</p>
                        <p>Go back to the chat and send a message to see the details here.</p>
                    </div>
                )}
            </CardContent>
        </Card>
       </div>
    </div>
  );
}
