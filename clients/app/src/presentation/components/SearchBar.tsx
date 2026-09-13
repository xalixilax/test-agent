import { InputGroup, InputGroupAddon, InputGroupInput } from "@design-system/ui/input-group";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
}

function SearchBar({ searchTerm, onSearch }: SearchBarProps) {
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
    </div>
  );
}

export default SearchBar;
