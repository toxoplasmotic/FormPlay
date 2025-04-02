import { Link } from "wouter";

interface HeaderProps {
  username: string;
}

export default function Header({ username }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <div className="flex-shrink-0 flex items-center cursor-pointer">
                <div className="h-8 w-8 rounded bg-gradient-to-br from-indigo-600 to-pink-500 flex items-center justify-center text-white font-bold">FP</div>
                <span className="ml-2 text-xl font-semibold text-gray-800">FormPlay</span>
              </div>
            </Link>
          </div>
          <div className="flex items-center">
            <div className="ml-3 relative">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">{username}</span>
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">{username[0]?.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
