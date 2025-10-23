"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DebugViewProps {
  request: any;
  response: any;
}

export function DebugView({ request, response }: DebugViewProps) {
  return (
    <Card className="mt-4 w-full text-sm">
      <CardContent className="pt-4">
        <Tabs defaultValue="response">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="response">API Response</TabsTrigger>
            <TabsTrigger value="request">API Request</TabsTrigger>
          </TabsList>
          <TabsContent value="response">
            <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-auto max-h-64">
              <code>{JSON.stringify(response, null, 2)}</code>
            </pre>
          </TabsContent>
          <TabsContent value="request">
            <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-auto max-h-64">
              <code>{JSON.stringify(request, null, 2)}</code>
            </pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
