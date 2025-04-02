import { Link } from "wouter";
import { getStatusBadgeColor, getStatusLabel, formatDate } from "@/lib/utils";

interface TpsListItemProps {
  report: any;
  isCreator: boolean;
}

export default function TpsListItem({ report, isCreator }: TpsListItemProps) {
  const statusColors = getStatusBadgeColor(report.status);
  const statusLabel = getStatusLabel(report.status, isCreator);
  
  return (
    <li className="cursor-pointer hover:bg-gray-50">
      <Link href={`/reports/${report.id}`}>
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="min-w-0 flex-1 flex items-center">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-indigo-100">
                    <span className="text-sm font-medium leading-none text-indigo-700">TPS</span>
                  </span>
                </div>
                <div className="min-w-0 flex-1 px-4">
                  <div>
                    <p className="text-sm font-medium text-indigo-600 truncate">
                      TPS Report - {
                        report.location === "master" ? "Master bedroom" : 
                        report.location === "basement" ? "Basement" : 
                        report.location === "other" ? `Other: ${report.location_other}` : 
                        report.location
                      }
                    </p>
                    <p className="mt-1 flex items-center text-sm text-gray-500">
                      <span>
                        Created by {report.creator_name} • {formatDate(report.created_at)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="ml-5 flex-shrink-0 flex items-center space-x-4">
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors.bgColor} ${statusColors.textColor}`}>
                {statusLabel}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
