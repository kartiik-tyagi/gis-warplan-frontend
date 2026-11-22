import { SearchSelect } from './SearchSelect'

export function PositionSelect({ users, value, onChange }) {
  return (
    <SearchSelect
      required
      label="User"
      options={users || []}
      value={value}
      onChange={onChange}
      getOptionLabel={(user) => user.title || user.name}
      getOptionValue={(user) => user.id}
    />
  )
}
