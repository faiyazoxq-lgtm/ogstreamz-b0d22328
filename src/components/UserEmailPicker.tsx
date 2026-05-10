import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UserPickerOption = {
  id: string;
  email: string;
  display_name?: string | null;
  rank?: string;
  status?: string;
};

type Props = {
  users: UserPickerOption[];
  /** Currently selected value — either user.id or, when allowFreeText, an arbitrary email. */
  value: string;
  onChange: (value: string, user: UserPickerOption | null) => void;
  /** Allow typing an email that doesn't match any existing user. */
  allowFreeText?: boolean;
  /** Optional first row (e.g. "Broadcast to all"). */
  allOption?: { value: string; label: string };
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
};

/** Searchable dropdown of users. Filters by email or display name as you type. */
export function UserEmailPicker({
  users,
  value,
  onChange,
  allowFreeText = false,
  allOption,
  placeholder = "Choose a user…",
  className,
  triggerClassName,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const byEmail = useMemo(
    () => new Map(users.map((u) => [u.email.toLowerCase(), u])),
    [users],
  );

  const selectedUser = byId.get(value) ?? byEmail.get(value.toLowerCase()) ?? null;
  const isAll = allOption && value === allOption.value;

  const triggerLabel = isAll
    ? allOption!.label
    : selectedUser
    ? `${selectedUser.email}${selectedUser.display_name ? ` · ${selectedUser.display_name}` : ""}`
    : value
    ? value
    : placeholder;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.slice(0, 200);
    return users
      .filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.display_name ?? "").toLowerCase().includes(q),
      )
      .slice(0, 200);
  }, [users, query]);

  const trimmedQuery = query.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedQuery);
  const showFreeText =
    allowFreeText &&
    isEmail &&
    !byEmail.has(trimmedQuery.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-bold text-left",
            !selectedUser && !isAll && !value && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", className)} align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search by email or name…"
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList className="max-h-72">
            <CommandEmpty>
              {showFreeText ? "No match — use typed email below." : "No users found."}
            </CommandEmpty>
            {allOption && (
              <CommandGroup>
                <CommandItem
                  value={allOption.value}
                  onSelect={() => {
                    onChange(allOption.value, null);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isAll ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {allOption.label}
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading={`Users (${filtered.length})`}>
                {filtered.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={u.id}
                    onSelect={() => {
                      onChange(u.id, u);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedUser?.id === u.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{u.email}</span>
                      {u.display_name && (
                        <span className="truncate text-xs text-muted-foreground">
                          {u.display_name}
                          {u.rank ? ` · ${u.rank}` : ""}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showFreeText && (
              <CommandGroup heading="Use typed email">
                <CommandItem
                  value={`__free__:${trimmedQuery}`}
                  onSelect={() => {
                    onChange(trimmedQuery, null);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Send to <span className="ml-1 font-bold">{trimmedQuery}</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}