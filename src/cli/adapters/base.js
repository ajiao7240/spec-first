/**
 * Base class for platform adapters
 * Each platform (Claude, Codex, etc.) implements this interface
 */
class PlatformAdapter {
  /**
   * Platform identifier (e.g., 'claude', 'codex')
   */
  get id() {
    throw new Error('Not implemented: id');
  }

  /**
   * Runtime root directory (e.g., '.claude', '.codex')
   */
  get runtimeRoot() {
    throw new Error('Not implemented: runtimeRoot');
  }

  /**
   * Managed root directory for spec-first state
   */
  get managedRoot() {
    throw new Error('Not implemented: managedRoot');
  }

  /**
   * Commands directory path
   */
  get commandRoot() {
    throw new Error('Not implemented: commandRoot');
  }

  /**
   * Skills directory path
   */
  get skillsRoot() {
    throw new Error('Not implemented: skillsRoot');
  }

  /**
   * Agents directory path
   */
  get agentsRoot() {
    throw new Error('Not implemented: agentsRoot');
  }

  /**
   * State file path
   */
  get stateFile() {
    throw new Error('Not implemented: stateFile');
  }

  /**
   * Developer metadata file path
   */
  get developerFile() {
    throw new Error('Not implemented: developerFile');
  }

  /**
   * Transform skill content for platform-specific runtime
   * @param {string} content - Original skill content
   * @returns {string} Transformed content
   */
  transformSkillContent(content) {
    return content;
  }

  /**
   * Transform agent content for platform-specific runtime
   * @param {string} content - Original agent content
   * @returns {string} Transformed content
   */
  transformAgentContent(content) {
    return content;
  }

  /**
   * Inspect platform runtime assets
   * @param {string} projectRoot - Project root directory
   * @returns {object} Inspection result
   */
  inspect(projectRoot) {
    throw new Error('Not implemented: inspect');
  }
}

module.exports = PlatformAdapter;
