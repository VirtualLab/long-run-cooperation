
// Set up route for visualization
Router.map( function() {
  this.route('viz', {
    path: 'viz/:batchName',
    waitOn: function() {
      return Meteor.subscribe("vizData", this.params.batchName);
    }
  });
});

function flatten(arrayOfArrays) {
  return [].concat.apply([], arrayOfArrays);
}

function getColorScale(userIds) {
  if ( userIds.length <= 10 ) return d3.scale.category10().domain(userIds);
  if ( userIds.length <= 20 ) return d3.scale.category20().domain(userIds);

  // http://stackoverflow.com/questions/20847161/colors-on-d3-js
  // https://gist.github.com/mbostock/310c99e53880faec2434
  const generator = d3.scale.cubehelix()
    .domain([0, .5, 1])
    .range([
      d3.hsl(-100, 0.75, 0.35),
      d3.hsl(  80, 1.50, 0.80),
      d3.hsl( 260, 0.75, 0.35)
    ]);

  const colors = userIds.map( (u, i) => { return generator(Math.random()) });
  return d3.scale.ordinal().domain(userIds).range(colors);
}

Template.viz.onRendered(function() {
  const svg = d3.select(this.find("svg"));
  const $svg = this.$("svg");
  const container = svg.select(".scaler");

  const height = $svg.height();
  const width = $svg.width();

  console.log(
    Experiments.find().count(),
    GameGroups.find().count(), // Only used to determine nodeWidth atm
    Actions.find().count()
  );

  console.log("Data loaded at ", new Date);

  // Instructions according to https://github.com/soxofaan/d3-plugin-captain-sankey

  // Generate list of nodes (instances), mapped to indices
  const instances = Experiments.find().fetch();
  const instanceMap = {};
  for( let [i, inst] of instances.entries() ) {
    instanceMap[inst._id] = i;
  }

  // Generate list of links (who went from one game to another)
  const users = _.uniq( flatten(
    Experiments.find().map( (g) => { return g.users }) ) );
  const supergames = GameGroups.find().count();

  const links = [];

  const colorScale = getColorScale(users);

  // For each user, generate a link for the list of games
  for( let userId of users) {
    const insts = Experiments.find({users: userId},
      {sort: {startTime: 1}}).fetch();

    for( let x = 1; x < insts.length; x++ ) {
      links.push({
        userId,
        source: instanceMap[insts[x-1]._id],
        target: instanceMap[insts[x]._id],
        value: 1
      });
    }
  }

  const layoutIterations = 10;

  // Scale appropriately, but limit display for very sparse data
  const maxNodeWidth = 100;
  const maxWidth = maxNodeWidth * 2 * supergames;

  const sankey = d3.sankey()
    .size([ Math.min(width, maxWidth), height ])
    .nodeWidth( Math.min( (width * 0.5) / supergames, maxNodeWidth) )
    .nodePadding(10)
    .nodes(instances)
    .links(links)
    .layout(layoutIterations);

  console.log("Layout done at ", new Date);

  const path = sankey.link();

  // Draw links
  container.selectAll('.link')
    .data(links)
    .enter().append('path')
    .attr('class', d => `link u_${d.userId}`)
    .attr('d', path)
    .style({
      stroke: (d) => { return colorScale(d.userId) },
      "stroke-width": (d) => { return Math.max(1, d.dy) }
    });

  // Draw nodes
  let games = container.selectAll('.node')
    .data(instances)
  .enter().append('a')
    .attr({
      target: '_blank',
      'xlink:href': (d) => Router.path('expAdmin', {groupId: d._id})
    })
  .append('g')
    .attr({
      'class': 'node',
      transform: (d) => { return `translate(${d.x}, ${d.y})` }
    });

  const rounds = 10;
  const nodeWidth = sankey.nodeWidth();

  games.append('title').text(d => d._id);
  games.append('rect')
    .attr({
      class: "game",
      height: function (d) { return d.dy; },
      width: nodeWidth
    });

  const x = d3.scale.ordinal()
      .domain( Array.from(Array(10)).map( (e, i) => i+1 ) )
      .rangeBands([0, nodeWidth]);

  const xBand = x.rangeBand();

  // Pre-group actions by _groupId and _roundIndex otherwise we are going to
  // get owned trying to search for each one by group
  const actionsByGroup = d3.nest()
    .key( d => d._groupId )
    .map(Actions.find().fetch(), d3.map);

  // Within games, draw actions
  games.each( function(d) {
    const actions = actionsByGroup.get(d._id);

    const y = d3.scale.ordinal()
      .domain(d.users)
      .rangeBands([0, d.dy]);

    const yBand = y.rangeBand();

    // Draw all the actions mwahaha
    d3.select(this).selectAll('.action')
      .data(actions)
    .enter().append('rect')
      .attr({
        'class': (d) => { return `action a${d.action}`},
        x: (d) => { return x(d.roundIndex) },
        y: (d) => { return y(d.userId) },
        width: xBand,
        height: yBand
      });

  });

  console.log("Rendering finished at ", new Date);

  // Set up zoom
  const zoom = d3.behavior.zoom();
  zoom.on("zoom", function() {
    container.attr("transform",
      `translate(${d3.event.translate})scale(${d3.event.scale})`);
  });

  svg.call(zoom);
});

Template.viz.events({
  "mouseenter .link": function(e, t) {
    const userId = d3.select(e.target).datum().userId;
    d3.select(t.find("svg"))
      .selectAll(`.link.u_${userId}`).classed("highlighted", true);
  },
  "mouseleave .link": function(e, t) {
    const userId = d3.select(e.target).datum().userId;
    d3.select(t.find("svg"))
      .selectAll(`.link.u_${userId}`).classed("highlighted", false);
  }
});
