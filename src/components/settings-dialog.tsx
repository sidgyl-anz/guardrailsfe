
"use client";

import { useState, useEffect } from 'react';
import { Cog, Save } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { useSettings } from '@/hooks/use-settings';
import { useToast } from '@/hooks/use-toast';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';

const AVAILABLE_DOMAINS = [
    'medlineplus.gov', 'arxiv.org', 'wikipedia.org', 'forbes.com', 'wsj.com', 'wired.com', 'techcrunch.com', 'youtube.com', 'reddit.com'
];

export function SettingsDialog() {
    const { searchDomains, systemPrompt, useGuardrails, setSearchDomains, setSystemPrompt, setUseGuardrails, isSettingsReady } = useSettings();
    const [localDomains, setLocalDomains] = useState<string[]>(searchDomains);
    const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
    const [localUseGuardrails, setLocalUseGuardrails] = useState(useGuardrails);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && isSettingsReady) {
            setLocalDomains(searchDomains || []);
            setLocalSystemPrompt(systemPrompt || '');
            setLocalUseGuardrails(useGuardrails);
        }
    }, [isOpen, isSettingsReady, searchDomains, systemPrompt, useGuardrails]);

    const handleSave = () => {
        setSearchDomains(localDomains);
        setSystemPrompt(localSystemPrompt);
        setUseGuardrails(localUseGuardrails);
        toast({
            title: "Settings Saved",
            description: "Your settings have been updated.",
        });
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Cog className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Manage your information sources and other settings.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                     <div className="space-y-2">
                        <Label htmlFor="system-prompt">System Prompt</Label>
                        <Textarea
                            id="system-prompt"
                            value={localSystemPrompt}
                            onChange={(e) => setLocalSystemPrompt(e.target.value)}
                            className="min-h-[120px] text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            Information Sources
                        </Label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-start font-normal">
                                    <span className="truncate">
                                        {localDomains.length > 0 ? `${localDomains.length} selected` : 'Select sources'}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="start">
                                <DropdownMenuLabel>Filter by information source</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {AVAILABLE_DOMAINS.map((domain) => (
                                    <DropdownMenuCheckboxItem
                                        key={domain}
                                        checked={localDomains.includes(domain)}
                                        onCheckedChange={(checked) => {
                                            const newDomains = checked
                                                ? [...localDomains, domain]
                                                : localDomains.filter((d) => d !== domain);
                                            setLocalDomains(newDomains);
                                        }}
                                    >
                                        {domain}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {localDomains.length > 0 ? localDomains.map(domain => (
                            <Badge key={domain} variant="secondary">{domain}</Badge>
                        )) : <p className="text-sm text-muted-foreground">No sources selected. Search will be across the web.</p>}
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                        <Label htmlFor="guardrails-switch">Use Guardrails</Label>
                        <p className="text-xs text-muted-foreground">
                            Enable to check input and output for safety.
                        </p>
                        </div>
                        <Switch
                            id="guardrails-switch"
                            checked={localUseGuardrails}
                            onCheckedChange={setLocalUseGuardrails}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
