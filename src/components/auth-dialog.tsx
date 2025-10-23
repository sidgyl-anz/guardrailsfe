
"use client";

import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth, initiateEmailSignUp, initiateEmailSignIn } from '@/firebase';

const signUpSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string()
    .min(9, { message: "Password must be at least 9 characters long." })
    .refine((password) => /[a-z]/.test(password), { message: "Password must contain at least one lowercase letter."})
    .refine((password) => /[A-Z]/.test(password), { message: "Password must contain at least one uppercase letter."})
    .refine((password) => /\d/.test(password), { message: "Password must contain at least one number."})
    .refine((password) => /[^a-zA-Z0-9]/.test(password), { message: "Password must contain at least one special character."}),
});

const signInSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export function AuthDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const auth = useAuth();
  const { toast } = useToast();

  const signUpForm = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "" },
  });

  const signInForm = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleSignUp = async (values: z.infer<typeof signUpSchema>) => {
    try {
      await initiateEmailSignUp(auth, values.email, values.password);
      setIsOpen(false);
      toast({
        title: "Welcome!",
        description: "Your account has been created successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: error.message,
      });
    }
  };
  
  const handleSignIn = async (values: z.infer<typeof signInSchema>) => {
    try {
      await initiateEmailSignIn(auth, values.email, values.password);
      setIsOpen(false);
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign In Failed",
        description: "Invalid credentials. Please check your email and password.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Login</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <DialogHeader>
              <DialogTitle>Sign In</DialogTitle>
              <DialogDescription>Access your chat history and settings.</DialogDescription>
            </DialogHeader>
            <Form {...signInForm}>
              <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4 py-4">
                <FormField
                  control={signInForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signInForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={signInForm.formState.isSubmitting}>
                    Sign In
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="signup">
            <DialogHeader>
              <DialogTitle>Sign Up</DialogTitle>
              <DialogDescription>Create an account to save your chats and settings.</DialogDescription>
            </DialogHeader>
            <Form {...signUpForm}>
              <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4 py-4">
                <FormField
                  control={signUpForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                   <Button type="submit" className="w-full" disabled={signUpForm.formState.isSubmitting}>
                    Create Account
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
