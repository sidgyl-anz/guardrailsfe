
"use client";

import { useState, useEffect, KeyboardEvent } from 'react';
import { Cog, Save, X } from 'lucide-react';
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
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Input } from './ui/input';

export function SettingsDialog() {
    const { searchDomains, systemPrompt, useGuardrails, setSearchDomains, setSystemPrompt, setUseGuardrails, isSettingsReady } = useSettings();
    const [localDomains, setLocalDomains] = useState<string[]>(searchDomains);
    const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
    const [localUseGuardrails, setLocalUseGuardrails] = useState(useGuardrails);
    const [domainInput, setDomainInput] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && isSettingsReady) {
            setLocalDomains(searchDomains || []);
            setLocalSystemPrompt(systemPrompt || '');
            setLocalUseGuardrails(useGuardrails);
            setDomainInput('');
        }
    }, [isOpen, isSettingsReady, searchDomains, systemPrompt, useGuardrails]);

    const sanitizeDomain = (value: string) => {
        return value
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .split('/')[0];
    };

    const addDomain = () => {
        const sanitized = sanitizeDomain(domainInput);
        if (!sanitized) {
            setDomainInput('');
            return;
        }

        if (!localDomains.includes(sanitized)) {
            setLocalDomains(prev => [...prev, sanitized]);
        }
        setDomainInput('');
    };

    const handleDomainKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addDomain();
        }
    };

    const removeDomain = (domain: string) => {
        setLocalDomains(prev => prev.filter(item => item !== domain));
    };

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
                        <Label htmlFor="information-source-input">
                            Information Sources
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="information-source-input"
                                value={domainInput}
                                onChange={(event) => setDomainInput(event.target.value)}
                                onKeyDown={handleDomainKeyDown}
                                placeholder="Add a source domain (e.g., medlineplus.gov)"
                                aria-describedby="information-source-helper"
                            />
                            <Button type="button" variant="secondary" onClick={addDomain} disabled={!domainInput.trim()}>
                                Add
                            </Button>
                        </div>
                        <p id="information-source-helper" className="text-xs text-muted-foreground">
                            Press Enter after typing each domain. Medlineplus.gov is included by default.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {localDomains.length > 0 ? localDomains.map(domain => (
                            <Badge key={domain} variant="secondary" className="flex items-center gap-1 pr-1">
                                <span>{domain}</span>
                                <button
                                    type="button"
                                    onClick={() => removeDomain(domain)}
                                    className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                                    aria-label={`Remove ${domain} from information sources`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )) : <p className="text-sm text-muted-foreground">No sources selected. Search will be across the web.</p>}
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                        <Label htmlFor="guardrails-switch">Use Guardrails</Label>
                        <p className="text-xs text-muted-foreground">
                            Enable to check input and output for safety.
                        </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="guardrails-switch"
                                checked={localUseGuardrails}
                                onCheckedChange={setLocalUseGuardrails}
                                aria-describedby="guardrails-status"
                            />
                            <span
                                id="guardrails-status"
                                className={`text-sm font-medium ${localUseGuardrails ? 'text-emerald-600' : 'text-muted-foreground'}`}
                            >
                                {localUseGuardrails ? 'On' : 'Off'}
                            </span>
                        </div>
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
