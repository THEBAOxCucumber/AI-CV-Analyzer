import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom"

import {
  AppLayout,
} from "./components/layout/AppLayout"

import {
  ProtectedRoute,
} from "./components/layout/ProtectedRoute"

import {
  DashboardPage,
} from "./pages/DashboardPage"

import {
  SignInPage,
} from "./pages/SignInPage"

import {
  UploadResumePage,
} from "./pages/UploadResumePage"

import {
  AnalysisResultPage,
} from "./pages/AnalysisResultPage"

import {
  HistoryPage,
} from "./pages/HistoryPage"

// import {
//   JobMatchPage,
// } from "./pages/JobMatchPage"

import {
  JobMatchesPage,
} from "./pages/JobMatchesPage"

import {
  InsightsPage,
} from "./pages/InsightsPage"

import {
  SettingsPage,
} from "./pages/SettingsPage"

// function ComingSoonPage({
//   title,
// }: {
//   title: string
// }) {
//   return (
//     <main
//       style={{
//         padding: "2rem",
//       }}
//     >
//       <h1>{title}</h1>
//     </main>
//   )
// }

function App() {
  return (
    <Routes>
      <Route
        path="/sign-in"
        element={<SignInPage />}
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="/resumes/upload"
          element={<UploadResumePage />}
        />

        <Route
          path="/history"
          element={<HistoryPage />}
        />

        {/* <Route
          path="/job-match"
          element={<JobMatchPage />}
        /> */}

        <Route
          path="/jobs"
          element={<JobMatchesPage />}
        />

        <Route
          path="/insights"
          element={<InsightsPage />}
        />

        <Route
          path="/settings"
          element={<SettingsPage />}
        />


        <Route
          path="/analyses/:analysisRunId"
          element={<AnalysisResultPage />}
        />


      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }

      />
    </Routes>


  )
}

export default App