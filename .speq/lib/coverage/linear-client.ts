import type { LinearIssue } from './types.js';

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const OPEN_STATES = ['Todo', 'In Progress', 'Backlog'];

interface GraphQLResponse {
  data?: {
    issues: {
      nodes: LinearIssue[];
    };
  };
  errors?: Array<{ message: string }>;
}

export async function fetchOpenIssues(teamKey?: string): Promise<LinearIssue[]> {
  const apiKey = process.env.LINEAR_API_KEY;
  
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY environment variable is required');
  }

  const filter: Record<string, unknown> = {
    state: { name: { in: OPEN_STATES } }
  };

  if (teamKey) {
    filter.team = { key: { eq: teamKey } };
  }

  const query = `
    query GetOpenIssues($filter: IssueFilterInput) {
      issues(filter: $filter, first: 100) {
        nodes {
          id
          identifier
          title
          state {
            name
          }
          team {
            key
          }
          url
        }
      }
    }
  `;

  const variables = { filter };

  try {
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Linear issues: ${response.status} ${response.statusText}`);
    }

    const result: GraphQLResponse = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new Error(`Linear API error: ${result.errors[0].message}`);
    }

    if (!result.data?.issues?.nodes) {
      return [];
    }

    return result.data.issues.nodes;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch Linear issues: ${error.message}`);
    }
    throw new Error('Failed to fetch Linear issues: Unknown error');
  }
}
