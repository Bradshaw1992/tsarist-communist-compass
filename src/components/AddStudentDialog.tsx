// =============================================================================
// AddStudentDialog — Teacher searches for a user by email and adds them
// to a class. Triggered from TeacherClassPage.
// =============================================================================
import { useState } from "react";
import { UserPlus, Search, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface UserResult {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
}

interface AddStudentDialogProps {
  classId: string;
  className: string;
  /** Called after a student is successfully added so the parent can refresh. */
  onAdded?: () => void;
}

export function AddStudentDialog({
  classId,
  className,
  onAdded,
}: AddStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      toast.error("Type at least 2 characters to search");
      return;
    }

    setSearching(true);
    try {
      // Search user_profiles by email or display_name (teacher has RLS read on
      // user_profiles via the read_all policy).
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, display_name, full_name")
        .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(20);

      if (error) throw error;
      setResults(data ?? []);
      if (!data?.length) {
        toast("No users found matching that search.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Search failed — try again");
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (userId: string) => {
    setAdding(userId);
    try {
      const { error } = await supabase
        .from("class_members")
        .upsert(
          { class_id: classId, student_id: userId },
          { onConflict: "class_id,student_id" }
        );

      if (error) throw error;

      setAdded((prev) => new Set(prev).add(userId));
      toast.success("Student added!");
      onAdded?.();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to add student");
    } finally {
      setAdding(null);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset state when dialog closes
      setQuery("");
      setResults([]);
      setAdded(new Set());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <UserPlus className="h-3.5 w-3.5" />
          Add student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Add student to {className}
          </DialogTitle>
          <DialogDescription>
            Search by name or email address, then click to add.
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex gap-2 pt-2">
          <Input
            placeholder="Search name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            autoFocus
          />
          <Button
            onClick={handleSearch}
            disabled={searching || query.trim().length < 2}
            size="icon"
            variant="secondary"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Results list */}
        {results.length > 0 && (
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {results.map((u) => {
              const isAdded = added.has(u.id);
              const name = u.display_name || u.full_name || u.email || "Unknown";
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {name}
                    </p>
                    {u.email && u.email !== name && (
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </p>
                    )}
                  </div>
                  {isAdded ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                      Added
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={adding === u.id}
                      onClick={() => handleAdd(u.id)}
                    >
                      {adding === u.id ? "Adding..." : "Add"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {searching && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Searching...
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
