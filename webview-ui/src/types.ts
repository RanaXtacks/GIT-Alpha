export interface ErroredFile {
    file: string;
    errors: string[];
}

export interface DuplicatePair {
    fileA: string;
    fileB: string;
    similarity: number;
}

export interface SecurityDetail {
    file: string;
    line: number;
    type: string;
}

export interface GitHubRepoData {
    name: string;
    stars: number;
    forks: number;
    openIssues: number;
    lastCommitMessage: string;
    lastCommitDate: string;
}
