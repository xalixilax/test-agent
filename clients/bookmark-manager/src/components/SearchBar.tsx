import { Button } from "@design-system/ui/button";
import { Input } from "@design-system/ui/input";
import { Search, X } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@design-system/ui/input-group";

interface SearchBarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
  compact?: boolean;
}

function SearchBar({ searchTerm, onSearch, compact = false }: SearchBarProps) {
  return (
    <div className="relative">
      <InputGroup>
        <InputGroupInput
          autoFocus
          type="text"
          placeholder="SEARCH..."
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-12"
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        {searchTerm && (
          <InputGroupAddon align="inline-end">
            <button onClick={() => onSearch("")} title="Clear search">
              <X />
            </button>
          </InputGroupAddon>
        )}
      </InputGroup>
      {/* <Input
        autoFocus
        type="text"
        placeholder="SEARCH..."
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full pl-12"
      />
      <Search />
      {searchTerm && (
        <Button
          onClick={() => onSearch("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 font-black text-lg hover:scale-110"
          variant="ghost"
          size="icon"
          title="Clear search"
        >
          <X />
        </Button>
      )} */}
    </div>
  );
}

export default SearchBar;
