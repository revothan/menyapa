import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type DomainSectionProps = {
  userId: string;
};

const DomainSection = ({ userId }: DomainSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customDomain, setCustomDomain] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("custom_domain")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (data?.custom_domain) {
        setCustomDomain(data.custom_domain);
      }
      return data;
    },
  });

  const updateDomain = useMutation({
    mutationFn: async (newDomain: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ custom_domain: newDomain })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Domain updated!",
        description: "Your custom domain has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update domain. Please try again.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = () => {
    if (profile?.custom_domain) {
      navigator.clipboard.writeText(`${window.location.origin}/bot/${profile.custom_domain}`);
      toast({
        title: "Link copied!",
        description: "The chatbot link has been copied to your clipboard.",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customDomain.trim()) {
      updateDomain.mutate(customDomain.trim());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Chatbot Domain</CardTitle>
        <CardDescription>
          Customize your chatbot's URL and share it with your visitors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="text-sm text-muted-foreground">
              {window.location.origin}/bot/
            </div>
            <Input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="your-custom-domain"
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={updateDomain.isPending}
            >
              {updateDomain.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>

        {profile?.custom_domain && (
          <>
            <div className="p-3 bg-muted rounded-md break-all">
              {window.location.origin}/bot/{profile.custom_domain}
            </div>
            <Button onClick={copyToClipboard} className="w-full">
              Copy Link
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DomainSection;