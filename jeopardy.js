// DOM elements
const $button = $(".start-reset-btn");
const $gameBoard = $(".game-board");
const $gameCategories = $(".category");
const $gameCards = $(".question");

// JeopardyObject class
class JeopardyObject {
  constructor(numCategories, numClues) {
    this.numCategories = numCategories;
    this.numClues = numClues;
    this.content = [];
    this.categoryIds = [];
    this.randomCluesBuffer = [];
    this.nextRandomClueIndex = 0;
  }

  /* Request random clues from the jservice API and store them as a buffer.
   *
   * The buffer is used to obtain unique random categories from random clues.
   * This is a workaround to the jservice API not having a random
   * category endpoint.
   */
  async requestRandomClues(count) {
    console.log("requestRandomClues()");
    const response = await axios.get(
      `https://jservice.io/api/random?count=${count}`
    );
    this.randomCluesBuffer = response.data;
    this.nextRandomClueIndex = 0;
  }

  /* Check if the random clues buffer is empty and requires a new request */
  shouldRequestNewRandomClues() {
    console.log("shouldRequestNewRandomClues()");
    return this.nextRandomClueIndex >= this.randomCluesBuffer.length;
  }

  /* Request a category from the jservice API and return it */
  async requestCategory(categoryId) {
    console.log("requestCategory()");
    const response = await axios.get(
      `https://jservice.io/api/category?id=${categoryId}`
    );
    return response.data;
  }

  /* Request random categories and clues from the jservice API
   * and store them.
   *
   * It gets the random categories through a workaround of requesting
   * random clues and then getting the category of each clue. It makes sure
   * that the category is unique and has enough clues to populate the column.
   *
   */
  async requestRandomCategoriesAndClues() {
    console.log("requestRandomCategoriesAndClues()");

    // get random clues for each 6 categories
    let category_counter = 0;
    while (category_counter < this.numCategories) {
      // check if the random clues buffer is empty
      // and in that case make a new request
      if (this.shouldRequestNewRandomClues()) {
        await this.requestRandomClues(100);
      }
      // get a random clue
      const clue = this.randomCluesBuffer[this.nextRandomClueIndex];
      const categoryId = clue.category_id;

      // check if the clue's category has already been added
      if (!this.categoryIds.includes(categoryId)) {
        const category = await this.requestCategory(clue.category_id);

        // if the category doesn't have enough clues to populate the column
        // then skip it
        if (category.clues_count < this.numClues) {
          continue;
        }

        // add the category to the jeopardy object
        const categoryOnBoard = this.addCategory(category);
        // get all the category clues to the column
        const categoryRandomClues = _.sampleSize(category.clues, this.numClues);
        this.addClues(categoryOnBoard, categoryRandomClues);

        category_counter++;
        this.nextRandomClueIndex++;
      }
    }
  }

  addCategory(category) {
    console.log("addCategory()");
    this.categoryIds.push(category.id);

    const categoryOnBoard = {
      title: category.title,
      clues: [],
    };
    this.content.push(categoryOnBoard);

    return categoryOnBoard;
  }

  addClue(categoryObject, clue) {
    console.log("addClue()");
    categoryObject.clues.push(clue);
  }

  addClues(categoryObject, clues) {
    console.log("addClues()");
    categoryObject.clues.push(...clues);
  }

  getCategoryObject(categoryColumn) {
    console.log("getCategoryObject()");
    return this.content[categoryColumn];
  }

  resetContent() {
    this.content = [];
    this.categoryIds = [];
    this.randomCluesBuffer = [];
  }
}

// Main data structure that contains the jeopardy game data
const jeopardyObject = new JeopardyObject(6, 5);

/** Handle clicking on a clue: show the question or answer.
 *
 * Uses the classes .hidden-clue, .showing-clue, and .showing-answer
 * to determine what to show:
 * - if currently ,hidden-clue, then show clue & set class to .showing-clue
 * - if currently .showing-clue, then show answer, set class to .showing-answer
 *  and & set class to .inactive
 * - if currently .showing-answer, do nothing
 * */
function CardClickHandler(evt) {
  // get the card that was clicked on
  // use closest to ensure $card always refers to the div, even
  // if the span was clicked
  const $card = $(evt.target).closest("div");

  const column = +$card.attr("data-colum");
  const row = +$card.attr("data-row");
  const categoryObject = jeopardyObject.getCategoryObject(column - 1);
  console.log("target=", evt.target);
  console.log("categoryObject=", categoryObject);
  console.log("row=", row);
  console.log("clues=", categoryObject.clues);
  const clue = categoryObject.clues[row - 1];

  if ($card.hasClass("hidden-clue")) {
    $card.off("click");
    $card.html(clue.question);
    $card.removeClass("hidden-clue");
    $card.addClass("showing-clue");
    $card.on("click", CardClickHandler);
  } else if ($card.hasClass("showing-clue")) {
    $card.off("click");
    $card.html(clue.answer);
    $card.removeClass("showing-clue");
    $card.addClass("showing-answer");
    $card.on("click", CardClickHandler);
    $card.off("click");
    $card.removeClass("active");
    $card.addClass("inactive");
  }
}

async function buttonClickHandler() {
  console.log("buttonClickHandler()");

  $button.off("click");
  if ($button.attr("data-function") === "start") {
    $button.text("Reset");
    $button.attr("data-function", "reset");
    await setupAndStart();
    $button.on("click", buttonClickHandler);
  } else {
    $button.text("Start");
    $button.attr("data-function", "start");
    await resetGame();
    $button.on("click", buttonClickHandler);
  }
}

$button.on("click", buttonClickHandler);

/** Wipe the current Jeopardy board, show the loading spinner,
 * and update the button used to fetch data.
 */
function showLoadingView() {}

/** Remove the loading spinner and update the button used to fetch data. */

function hideLoadingView() {}

/** Create HTML board using divs and put it in the DOM. */
function createJeopardyBoard(columns, rows) {
  $gameBoard.hide().empty();

  // create the header row and append it to the game board
  $gameBoard.append($("<div>").addClass("category-row"));
  // create the category rows and append them to the game board
  for (let column = 1; column < columns + 1; column++) {
    const $category = $("<div>").addClass("category");
    $category.attr("id", `category-${column}`);
    $gameBoard.append($category);
  }

  // create the questions/clue rows and append them to the game board
  for (let row = 1; row < rows + 1; row++) {
    // create the question row and append it to the game board
    const $questionRow = $("<div>").addClass("clue-row");
    $questionRow.attr("id", `row-${row}`);
    $gameBoard.append($questionRow);

    // create the question/clue cells and append them to the question row
    for (let column = 1; column < 7; column++) {
      const $questionCell = $("<div>").addClass("card inactive hidden-clue");
      $questionCell.attr("id", `card-${column}-row-${row}`);
      $questionCell.attr("data-colum", `${column}`);
      $questionCell.attr("data-row", `${row}`);
      // set the text of the question cell to a question mark
      $questionCell.append("<span>?</span>");
      $questionRow.append($questionCell);
    }
  }

  // show the game board in order to avoid a flash of the background color
  $gameCategories.show();
  $gameCards.show();
  $gameBoard.show();
}

function putCategoryTitleOnBoard(categoryObject, column) {
  const $categoryRow = $(`#category-${column}`);
  $categoryRow.html(categoryObject.title.toUpperCase());
}

function putCategoriesOnBoard() {
  for (let column = 1; column < 7; column++) {
    const categoryObject = jeopardyObject.getCategoryObject(column - 1);
    putCategoryTitleOnBoard(categoryObject, column);
  }
}

/** Setup and Start game:
 *
 * - get random category Ids
 * - get data for each category
 * - create the game board
 * - fill the board
 * */
async function setupAndStart() {
  console.log("setupAndStart()");

  await jeopardyObject.requestRandomCategoriesAndClues();
  putCategoriesOnBoard();
  $(".card").addClass("active");
  $(".card").on("click", CardClickHandler);
}

async function resetGame() {
  $gameBoard.hide();
  $gameBoard.empty();
  jeopardyObject.resetContent();
  loadGame();
}

function loadGame() {
  createJeopardyBoard(6, 5);
  $button.show();
}

// Render the game board and show the start button
$(loadGame);
